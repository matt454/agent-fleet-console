# shellcheck shell=bash
# Sourced by bin/hermes-docker.

usage() {
  cat <<'USAGE'
Usage:
  hermes-docker deploy NAME [--from-profile PATH] [--from-workspace PATH] [--dashboard-port auto|PORT] [--vnc-port auto|PORT] [--health-port auto|PORT] [--web-port auto|PORT] [--with-camofox|--without-camofox]
  hermes-docker start NAME
  hermes-docker stop NAME
  hermes-docker restart NAME
  hermes-docker update NAME
  hermes-docker delete NAME
  hermes-docker logs NAME [hermes|camofox|web|health]
  hermes-docker shell NAME
  hermes-docker hermes NAME [args...]
  hermes-docker memory-status NAME
  hermes-docker memory-repair NAME
  hermes-docker browser NAME [URL]
  hermes-docker browser-save NAME [USER_ID]
  hermes-docker status NAME
  hermes-docker cutover veraxa
USAGE
}

die() {
  echo "hermes-docker: $*" >&2
  exit 1
}

require_name() {
  local name="${1:-}"
  [[ -n "$name" ]] || die "missing instance name"
  [[ "$name" =~ ^[a-z0-9]([a-z0-9_-]{0,61}[a-z0-9])?$ ]] || die "invalid instance name: $name (use lowercase letters, numbers, hyphens, or underscores; start and end with a letter or number)"
}

instance_dir() {
  echo "$ROOT/$1"
}

compose_project() {
  local safe
  safe="$(printf '%s' "$1" | tr -c 'A-Za-z0-9' '_')"
  echo "hermes_${safe}"
}

compose_file() {
  echo "$(instance_dir "$1")/compose.yaml"
}

compose_cmd() {
  local name="$1"
  local file
  file="$(compose_file "$name")"
  [[ -f "$file" ]] || die "compose file not found for '$name': $file"
  $COMPOSE_BIN -p "$(compose_project "$name")" -f "$file" "${@:2}"
}

delete_instance() {
  local name="$1"
  require_name "$name"
  local dir trash stamp target
  dir="$(instance_dir "$name")"
  [[ -d "$dir" ]] || die "instance directory not found for '$name': $dir"

  if [[ -f "$(compose_file "$name")" ]]; then
    browser_save_best_effort "$name" || warn "browser save skipped for $name"
    compose_cmd "$name" down
  fi

  trash="$ROOT/.trash"
  stamp="$(date -u +%Y%m%dT%H%M%SZ)"
  target="$trash/${name}-${stamp}"
  mkdir -p "$trash"
  mv "$dir" "$target"
  echo "Deleted $name. Instance data moved to $target"
}

update_instance() {
  local name="$1"
  require_name "$name"

  local dir env_file home dashboard_port vnc_port health_port web_port with_camofox created_at previous_image next_image
  dir="$(instance_dir "$name")"
  env_file="$dir/instance.env"
  home="$dir/home"
  [[ -f "$(compose_file "$name")" ]] || die "compose file not found for '$name': $(compose_file "$name")"
  [[ -f "$env_file" ]] || die "instance environment not found for '$name': $env_file"

  # shellcheck disable=SC1090
  . "$env_file"
  dashboard_port="${DASHBOARD_PORT:-}"
  vnc_port="${VNC_PORT:-}"
  health_port="${HEALTH_PORT:-}"
  web_port="${WEB_PORT:-auto}"
  with_camofox="${CAMOFOX_ENABLED:-0}"
  created_at="${CREATED_AT:-}"
  previous_image="${HERMES_IMAGE:-}"
  [[ -n "$dashboard_port" ]] || die "DASHBOARD_PORT is missing from $env_file"
  [[ -n "$health_port" ]] || die "HEALTH_PORT is missing from $env_file"
  web_port="$(free_port "$web_port" 9400 9499)"

  refresh_hermes_source
  build_images 0
  next_image="$(hermes_image)"
  repair_mnemosyne_profile "$name"
  write_compose "$name" "$dashboard_port" "$vnc_port" "$with_camofox" "$health_port" "$web_port"
  write_web_instructions "$name" "$web_port"
  if [[ -n "$created_at" ]]; then
    set_env_value "$env_file" "CREATED_AT" "$created_at"
  fi
  compose_cmd "$name" config >/dev/null
  compose_cmd "$name" up -d --no-deps --force-recreate hermes

  if [[ "$previous_image" == "$next_image" ]]; then
    echo "Recreated '$name' with current image $next_image"
  else
    echo "Updated '$name' from ${previous_image:-unknown} to $next_image"
  fi
}

refresh_hermes_source() {
  [[ -d "$HERMES_AGENT_SRC/.git" ]] || return 0

  local upstream
  upstream="$(git -C "$HERMES_AGENT_SRC" rev-parse --abbrev-ref --symbolic-full-name '@{upstream}' 2>/dev/null || true)"
  if [[ -z "$upstream" ]]; then
    echo "Hermes source has no upstream configured; using local checkout $(hermes_rev)"
    return 0
  fi

  echo "Fetching Hermes source updates from ${upstream%/*}"
  git -C "$HERMES_AGENT_SRC" fetch --prune

  if git -C "$HERMES_AGENT_SRC" merge-base --is-ancestor HEAD "$upstream"; then
    git -C "$HERMES_AGENT_SRC" merge --ff-only "$upstream"
    echo "Hermes source is at $(hermes_rev)"
    return 0
  fi

  die "Hermes source is not a fast-forward from $upstream; resolve $HERMES_AGENT_SRC before updating agents"
}

camofox_api_key() {
  local dir="$1"
  local key=""
  if [[ -f "$dir/instance.env" ]]; then
    key="$(awk -F= '$1=="CAMOFOX_API_KEY"{print substr($0, index($0, "=") + 1); exit}' "$dir/instance.env" 2>/dev/null || true)"
  fi
  if [[ -z "$key" && -f "$dir/compose.yaml" ]]; then
    key="$(
      awk '
        /^[[:space:]]*CAMOFOX_API_KEY:/ {
          sub(/^[^:]*:[[:space:]]*/, "", $0)
          gsub(/^["'\'']|["'\'']$/, "", $0)
          print
          exit
        }
      ' "$dir/compose.yaml" 2>/dev/null || true
    )"
  fi
  printf '%s\n' "$key"
}

hermes_rev() {
  git -C "$HERMES_AGENT_SRC" rev-parse --short=12 HEAD
}

hermes_base_image() {
  echo "local/hermes-agent:$(hermes_rev)-base"
}

hermes_image() {
  echo "local/hermes-agent:$(hermes_rev)-mnemosyne"
}

build_images() {
  local include_camofox="${1:-1}"
  command -v docker >/dev/null 2>&1 || die "docker is not on PATH"
  [[ -d "$HERMES_AGENT_SRC" ]] || die "Hermes source not found: $HERMES_AGENT_SRC"

  local base_image h_image tmp_dockerfile
  base_image="$(hermes_base_image)"
  h_image="$(hermes_image)"
  if ! docker image inspect "$base_image" >/dev/null 2>&1; then
    echo "Building $base_image from $HERMES_AGENT_SRC"
    docker build -t "$base_image" "$HERMES_AGENT_SRC"
  else
    echo "Using existing $base_image"
  fi

  if ! docker image inspect "$h_image" >/dev/null 2>&1; then
    echo "Building $h_image with Mnemosyne memory provider"
    tmp_dockerfile="$(mktemp)"
    cat > "$tmp_dockerfile" <<EOF
FROM $base_image
RUN uv pip install --python /opt/hermes/.venv/bin/python --no-cache-dir mnemosyne-hermes \\
  && pkg="\$(/opt/hermes/.venv/bin/python -c 'import pathlib, mnemosyne_hermes; print(pathlib.Path(mnemosyne_hermes.__file__).resolve().parent)')" \\
  && mkdir -p /opt/hermes/plugins/memory/mnemosyne \\
  && ln -sfn "\$pkg"/* /opt/hermes/plugins/memory/mnemosyne/
EOF
    docker build -t "$h_image" -f "$tmp_dockerfile" .
    rm -f "$tmp_dockerfile"
  else
    echo "Using existing $h_image"
  fi

  [[ -f "$WEBHOST_CONTEXT/Dockerfile" ]] || die "Webhost Dockerfile not found: $WEBHOST_CONTEXT/Dockerfile"
  if ! docker image inspect "$WEBHOST_IMAGE" >/dev/null 2>&1; then
    echo "Building $WEBHOST_IMAGE from $WEBHOST_CONTEXT"
    docker build -t "$WEBHOST_IMAGE" "$WEBHOST_CONTEXT"
  else
    echo "Using existing $WEBHOST_IMAGE"
  fi

  if [[ "$include_camofox" != "1" ]]; then
    return
  fi

  [[ -f "$CAMOFOX_CONTEXT/Dockerfile" ]] || die "Camofox Dockerfile not found: $CAMOFOX_CONTEXT/Dockerfile"
  if ! docker image inspect "$CAMOFOX_IMAGE" >/dev/null 2>&1; then
    echo "Building $CAMOFOX_IMAGE from $CAMOFOX_CONTEXT"
    docker build \
      --build-arg "CAMOFOX_BROWSER_VERSION=$CAMOFOX_VERSION" \
      -t "$CAMOFOX_IMAGE" \
      "$CAMOFOX_CONTEXT"
  else
    echo "Using existing $CAMOFOX_IMAGE"
  fi
}

memory_status() {
  local name="$1"
  require_name "$name"
  local home env_file cfg provider data_dir plugin_link vendor_link image
  home="$(instance_dir "$name")/home"
  env_file="$(instance_dir "$name")/instance.env"
  cfg="$home/config.yaml"
  [[ -d "$home" ]] || die "instance home not found for '$name': $home"

  provider="$(
    ruby -ryaml -e 'data=YAML.load_file(ARGV[0]) || {}; puts((data.dig("memory", "provider") || "").to_s)' "$cfg" 2>/dev/null || true
  )"
  data_dir="$home/mnemosyne/data"
  plugin_link="$home/plugins/mnemosyne"
  vendor_link="$home/vendor/mnemosyne"
  image=""
  if [[ -f "$env_file" ]]; then
    image="$(awk -F= '$1=="HERMES_IMAGE"{print substr($0, index($0, "=") + 1); exit}' "$env_file" 2>/dev/null || true)"
  fi

  echo "Memory status for '$name'"
  echo "  Provider: ${provider:-unset}"
  echo "  Data dir: $data_dir"
  if [[ -d "$data_dir" ]]; then
    echo "  Data:     present ($(find "$data_dir" -type f 2>/dev/null | wc -l | tr -d ' ') files)"
  else
    echo "  Data:     missing"
  fi
  if [[ -e "$plugin_link" || -L "$plugin_link" ]]; then
    echo "  Plugin:   $plugin_link -> $(readlink "$plugin_link" 2>/dev/null || printf 'directory')"
  elif [[ -d "$vendor_link" ]]; then
    echo "  Plugin:   vendor present at $vendor_link"
  else
    echo "  Plugin:   image-backed"
  fi
  echo "  Image:    ${image:-unknown}"
}
