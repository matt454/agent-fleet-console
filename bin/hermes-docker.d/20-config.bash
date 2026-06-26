# shellcheck shell=bash
# Sourced by bin/hermes-docker.

set_env_value() {
  local file="$1"
  local key="$2"
  local value="$3"
  touch "$file"
  python3 - "$file" "$key" "$value" <<'PY'
from pathlib import Path
import sys
path = Path(sys.argv[1])
key = sys.argv[2]
value = sys.argv[3]
lines = path.read_text().splitlines() if path.exists() else []
out = []
done = False
for line in lines:
    if line.startswith(key + "="):
        out.append(f"{key}={value}")
        done = True
    else:
        out.append(line)
if not done:
    out.append(f"{key}={value}")
path.write_text("\n".join(out).rstrip() + "\n")
PY
}

random_hex() {
  local bytes="${1:-32}"
  python3 - "$bytes" <<'PY'
import secrets
import sys
print(secrets.token_hex(int(sys.argv[1])))
PY
}

unset_env_value() {
  local file="$1"
  local key="$2"
  [[ -f "$file" ]] || return 0
  python3 - "$file" "$key" <<'PY'
from pathlib import Path
import sys
path = Path(sys.argv[1])
key = sys.argv[2]
lines = path.read_text().splitlines() if path.exists() else []
out = [line for line in lines if not line.startswith(key + "=")]
path.write_text("\n".join(out).rstrip() + ("\n" if out else ""))
PY
}

rewrite_paths() {
  local home="$1"
  local profile_src="$2"
  local workspace_src="$3"
  local escaped_profile escaped_workspace
  escaped_profile="$(printf '%s' "$profile_src" | sed 's/[.[\*^$()+?{}|\\]/\\&/g')"
  escaped_workspace="$(printf '%s' "$workspace_src" | sed 's/[.[\*^$()+?{}|\\]/\\&/g')"
  find "$home" -type f \( \
      -name '*.yaml' -o -name '*.yml' -o -name '*.json' -o -name '*.md' -o \
      -name '*.txt' -o -name '*.sh' -o -name '*.py' -o -name '.env' -o \
      -name '.hermes_history' \
    \) -size -10M -print0 |
    LC_ALL=C LANG=C xargs -0 perl -0pi -e "s#${escaped_workspace}#/opt/data/workspace#g; s#${escaped_profile}#/opt/data#g; s#/Users/matthew/hermes-instances/[^/]+/workspace#/opt/data/workspace#g; s#/Users/matthew/\\.hermes#/opt/data#g"
}

patch_config() {
  local home="$1"
  local profile_src="$2"
  local workspace_src="$3"
  local camofox_user_id="$4"
  local cfg="$home/config.yaml"
  [[ -f "$cfg" ]] || return 0
  ruby -ryaml - "$cfg" "$profile_src" "$workspace_src" "$camofox_user_id" <<'RUBY'
path, profile_src, workspace_src, camofox_user_id = ARGV
data = YAML.load_file(path) || {}
data["terminal"] ||= {}
data["terminal"]["cwd"] = "/opt/data/workspace"
data["browser"] ||= {}
data["browser"]["camofox"] ||= {}
data["browser"]["camofox"]["managed_persistence"] = true
data["browser"]["camofox"]["adopt_existing_tab"] = true
data["browser"]["camofox"]["user_id"] = camofox_user_id if camofox_user_id && !camofox_user_id.empty?
data["memory"] ||= {}
data["memory"]["memory_enabled"] = true
data["memory"]["user_profile_enabled"] = true
data["memory"]["provider"] = "mnemosyne"

text = YAML.dump(data)
text = text.gsub(workspace_src, "/opt/data/workspace")
text = text.gsub(profile_src, "/opt/data")
text = text.gsub(%r{/Users/matthew/hermes-instances/[^/]+/workspace}, "/opt/data/workspace")
text = text.gsub("/Users/matthew/.hermes", "/opt/data")
File.write(path, text)
RUBY
}

copy_mnemosyne_vendor() {
  local home="$1"
  local src=""
  for candidate in \
    "$ROOT/veraxa/home/vendor/mnemosyne" \
    "/Users/matthew/.hermes/profiles/veraxa/vendor/mnemosyne"
  do
    if [[ -d "$candidate" ]]; then
      src="$candidate"
      break
    fi
  done

  mkdir -p "$home/plugins" "$home/vendor" "$home/mnemosyne/data"
  if [[ -n "$src" ]]; then
    rsync_copy "$src" "$home/vendor/mnemosyne" \
      --exclude '.git/' \
      --exclude '__pycache__/' \
      --exclude '*.pyc' \
      --exclude '.pytest_cache/' \
      --exclude '.ruff_cache/' \
      --exclude '.mypy_cache/' \
      --exclude '.venv/' \
      --exclude 'venv/' \
      --exclude 'node_modules/'
    rm -f "$home/plugins/mnemosyne"
    ln -s ../vendor/mnemosyne/hermes_memory_provider "$home/plugins/mnemosyne"
  fi
}

ensure_mnemosyne_profile() {
  local home="$1"
  mkdir -p "$home/mnemosyne/data" "$home/plugins"
  set_env_value "$home/.env" "MNEMOSYNE_DATA_DIR" "/opt/data/mnemosyne/data"

  if [[ -d "$home/vendor/mnemosyne/hermes_memory_provider" ]]; then
    rm -f "$home/plugins/mnemosyne"
    ln -s ../vendor/mnemosyne/hermes_memory_provider "$home/plugins/mnemosyne"
  elif [[ -L "$home/plugins/mnemosyne" && ! -e "$home/plugins/mnemosyne" ]]; then
    rm -f "$home/plugins/mnemosyne"
  fi

  if [[ -f "$home/config.yaml" ]]; then
    ruby -ryaml - "$home/config.yaml" <<'RUBY'
path = ARGV[0]
data = YAML.load_file(path) || {}
data["memory"] ||= {}
data["memory"]["memory_enabled"] = true
data["memory"]["user_profile_enabled"] = true
data["memory"]["provider"] = "mnemosyne"
File.write(path, YAML.dump(data))
RUBY
  fi
}

repair_mnemosyne_profile() {
  local name="$1"
  require_name "$name"
  local home
  home="$(instance_dir "$name")/home"
  [[ -d "$home" ]] || die "instance home not found for '$name': $home"
  copy_mnemosyne_vendor "$home"
  ensure_mnemosyne_profile "$home"
  echo "Repaired Mnemosyne profile settings for '$name'"
}

init_fresh_profile() {
  local name="$1"
  local home="$2"
  local camofox_user_id="$3"

  mkdir -p \
    "$home/browser_auth/camofox/profiles" \
    "$home/home/.cache/camoufox/addons" \
    "$home/cron" \
    "$home/hooks" \
    "$home/home" \
    "$home/logs" \
    "$home/memories" \
    "$home/plans" \
    "$home/sessions" \
    "$home/skills"
  copy_mnemosyne_vendor "$home"

  if [[ ! -f "$home/auth.json" && -f "$HERMES_AUTH_SRC" ]]; then
    rsync_copy "$HERMES_AUTH_SRC" "$home/auth.json"
    chmod 600 "$home/auth.json" 2>/dev/null || true
  fi

  if [[ ! -f "$home/SOUL.md" ]]; then
    cat > "$home/SOUL.md" <<EOF
# ${name}

You are Matthew's personal Hermes assistant. Be practical, warm, concise, and proactive. Help with daily planning, research, writing, systems, and follow-through while keeping personal context separate from other Hermes instances.

When asked to create, host, publish, preview, or update a webpage, publish static files to /opt/data/workspace/web and use /opt/data/workspace/web/index.html as the default page. Use HERMES_WEB.md in the workspace for the current local and LAN URLs.
EOF
  fi

  if [[ ! -f "$home/config.yaml" ]]; then
    cat > "$home/config.yaml" <<EOF
model:
  default: gpt-5.5
  provider: openai-codex
  base_url: https://chatgpt.com/backend-api/codex
terminal:
  backend: local
  cwd: /opt/data/workspace
  timeout: 180
  persistent_shell: true
browser:
  engine: auto
  auto_local_for_private_urls: true
  camofox:
    managed_persistence: true
    user_id: ${camofox_user_id}
    session_key: ""
    adopt_existing_tab: true
memory:
  memory_enabled: true
  user_profile_enabled: true
  provider: mnemosyne
timezone: Europe/London
EOF
  fi
  ensure_mnemosyne_profile "$home"
}
