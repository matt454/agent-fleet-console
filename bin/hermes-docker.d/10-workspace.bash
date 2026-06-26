# shellcheck shell=bash
# Sourced by bin/hermes-docker.

free_port() {
  local preferred="${1:-auto}"
  local start="${2:-9120}"
  local end="${3:-9219}"
  if [[ "$preferred" != "auto" ]]; then
    echo "$preferred"
    return
  fi
  local docker_ports=""
  docker_ports="$(docker ps --format '{{.Ports}}' 2>/dev/null || true)"
  DOCKER_PORTS="$docker_ports" python3 - "$start" "$end" <<'PY'
import os
import re
import socket
import sys
start, end = map(int, sys.argv[1:3])
docker_ports = os.environ.get("DOCKER_PORTS", "")
for port in range(start, end + 1):
    if re.search(rf"(^|[\s,])(?:[^\s,]+:)?{port}->", docker_ports):
        continue
    for host in ("127.0.0.1", "0.0.0.0"):
        s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        s.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        try:
            s.bind((host, port))
        except OSError:
            s.close()
            break
        else:
            s.close()
    else:
        print(port)
        raise SystemExit
raise SystemExit(f"no free port in {start}-{end}")
PY
}

lan_ip() {
  local iface=""
  local ip=""
  iface="$(route get default 2>/dev/null | awk '/interface:/{print $2; exit}')" || true
  if [[ -n "$iface" ]]; then
    ip="$(ipconfig getifaddr "$iface" 2>/dev/null || true)"
  fi
  if [[ -z "$ip" ]]; then
    ip="$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || true)"
  fi
  printf '%s\n' "${ip:-<this-machine-lan-ip>}"
}

rsync_copy() {
  local src="$1"
  local dest="$2"
  shift 2
  [[ -e "$src" ]] || return 0
  mkdir -p "$(dirname "$dest")"
  if [[ -d "$src" ]]; then
    mkdir -p "$dest"
    rsync -a --delete "$@" "$src/" "$dest/"
  else
    rsync -a "$src" "$dest"
  fi
}

sync_workspace() {
  local src="$1"
  local dest="$2"
  mkdir -p "$dest"
  if [[ -n "$src" ]]; then
    [[ -d "$src" ]] || die "workspace source not found: $src"
    local src_real dest_real
    src_real="$(cd "$src" && pwd -P)"
    dest_real="$(cd "$dest" && pwd -P)"
    if [[ "$src_real" != "$dest_real" ]]; then
      rsync -a --delete --delete-excluded \
        --exclude '.venv/' \
        --exclude 'venv/' \
        --exclude '__pycache__/' \
        --exclude '.pytest_cache/' \
        --exclude '.ruff_cache/' \
        --exclude '.mypy_cache/' \
        --exclude 'node_modules/' \
        "$src/" "$dest/"
    fi
  fi
  find "$dest" \( -name '.venv' -o -name 'venv' -o -name 'node_modules' -o -name '__pycache__' -o -name '.pytest_cache' -o -name '.ruff_cache' -o -name '.mypy_cache' \) -prune -exec rm -rf {} + 2>/dev/null || true
}

copy_light_profile() {
  local src="$1"
  local home="$2"
  [[ -d "$src" ]] || die "profile source not found: $src"
  mkdir -p "$home"

  for file in .env auth.json config.yaml SOUL.md channel_directory.json; do
    rsync_copy "$src/$file" "$home/$file"
  done

  for dir in cron memories skills mnemosyne fundraising instantly linkedin_crm scripts; do
    rsync_copy "$src/$dir" "$home/$dir" \
      --exclude '__pycache__/' \
      --exclude '*.pyc' \
      --exclude '.pytest_cache/' \
      --exclude '.ruff_cache/' \
      --exclude 'node_modules/' \
      --exclude '.venv/' \
      --exclude 'venv/'
  done

  if [[ -d "$src/browser_auth/camofox/profiles" ]]; then
    rsync_copy "$src/browser_auth/camofox/profiles" "$home/browser_auth/camofox/profiles"
  fi
  if [[ -d "$src/home/.cache/camoufox/addons" ]]; then
    rsync_copy "$src/home/.cache/camoufox/addons" "$home/home/.cache/camoufox/addons"
  fi

  if [[ -d "$src/vendor/mnemosyne" ]]; then
    rsync_copy "$src/vendor/mnemosyne" "$home/vendor/mnemosyne" \
      --exclude '.git/' \
      --exclude '__pycache__/' \
      --exclude '*.pyc' \
      --exclude '.pytest_cache/' \
      --exclude '.ruff_cache/' \
      --exclude '.mypy_cache/' \
      --exclude '.venv/' \
      --exclude 'venv/' \
      --exclude 'node_modules/'
  fi

  ensure_mnemosyne_profile "$home"

  rm -f "$home/gateway.pid" "$home/gateway.lock" "$home/auth.lock" "$home/processes.json"
  rm -f "$home/state.db-shm" "$home/state.db-wal" "$home/response_store.db-shm" "$home/response_store.db-wal"
  mkdir -p "$home/logs" "$home/sessions" "$home/hooks" "$home/plans" "$home/home"
}

first_camofox_user_id() {
  local home="$1"
  python3 - "$home/browser_auth/camofox/profiles" <<'PY'
import json, pathlib, sys
root = pathlib.Path(sys.argv[1])
if not root.exists():
    raise SystemExit
for meta in sorted(root.glob("*/meta.json")):
    try:
        user = json.loads(meta.read_text()).get("userId", "")
    except Exception:
        continue
    if user:
        print(user)
        raise SystemExit
PY
}

default_camofox_user_id() {
  python3 - "$1" <<'PY'
import hashlib
import sys

name = sys.argv[1].encode()
print("hermes_" + hashlib.sha256(name).hexdigest()[:10])
PY
}

configured_camofox_user_id() {
  local home="$1"
  local cfg="$home/config.yaml"
  if [[ -f "$cfg" ]]; then
    ruby -ryaml - "$cfg" <<'RUBY'
path = ARGV.fetch(0)
data = YAML.load_file(path) || {}
user_id = data.dig("browser", "camofox", "user_id")
puts user_id if user_id && !user_id.to_s.empty?
RUBY
  fi
}

write_web_instructions() {
  local name="$1"
  local web_port="$2"
  local workspace web_root lan
  workspace="$(instance_dir "$name")/workspace"
  web_root="$workspace/web"
  lan="$(lan_ip)"
  mkdir -p "$web_root"
  cat > "$workspace/HERMES_WEB.md" <<EOF
# Hermes Web Publishing

This agent can publish a locally hosted web page from its workspace.

- When a user asks you to create, host, publish, preview, or update a webpage, write the files here.
- Put site files in \`/opt/data/workspace/web\`.
- Use \`/opt/data/workspace/web/index.html\` as the default page.
- Use relative paths for CSS, JavaScript, images, and other assets.
- The local URL is \`http://127.0.0.1:${web_port}\`.
- The LAN URL is \`http://${lan}:${web_port}\`.
- In the agent environment, read \`HERMES_WEB_ROOT\`, \`HERMES_WEB_URL\`, and \`HERMES_WEB_LAN_URL\` when you need these values.

The web host serves static files and falls back to \`index.html\` for single-page apps. Do not use another port unless the user explicitly asks for a custom server.
EOF
}
