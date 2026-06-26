# shellcheck shell=bash
# Sourced by bin/hermes-docker.

browser() {
  local name="$1"
  local url="${2:-https://example.com}"
  require_name "$name"

  local home configured_user_id profile_user_id user_id
  home="$(instance_dir "$name")/home"
  configured_user_id="$(configured_camofox_user_id "$home" || true)"
  profile_user_id="$(first_camofox_user_id "$home" || true)"
  user_id="${CAMOFOX_VIEWER_USER_ID:-${configured_user_id:-${profile_user_id:-hermes-vnc}}}"
  local session_key="${CAMOFOX_VIEWER_SESSION_KEY:-viewer}"

  local payload
  payload="$(python3 - "$user_id" "$session_key" "$url" <<'PY'
import json
import sys

print(json.dumps({
    "userId": sys.argv[1],
    "sessionKey": sys.argv[2],
    "url": sys.argv[3],
}))
PY
)"

  compose_cmd "$name" exec -T camofox curl -fsS \
    -X POST http://127.0.0.1:9377/tabs \
    -H "Content-Type: application/json" \
    -d "$payload"
  echo

  if [[ -f "$(instance_dir "$name")/instance.env" ]]; then
    # shellcheck disable=SC1090
    . "$(instance_dir "$name")/instance.env"
    if [[ -n "${VNC_PORT:-}" ]]; then
      echo "Camofox: http://127.0.0.1:${VNC_PORT}/vnc.html"
      echo "LAN VNC: http://$(lan_ip):${VNC_PORT}/vnc.html"
    fi
  fi
}

browser_save() {
  local name="$1"
  require_name "$name"

  local home configured_user_id profile_user_id user_id env_file key
  home="$(instance_dir "$name")/home"
  env_file="$(instance_dir "$name")/instance.env"
  configured_user_id="$(configured_camofox_user_id "$home" || true)"
  profile_user_id="$(first_camofox_user_id "$home" || true)"
  user_id="${2:-${configured_user_id:-${profile_user_id:-}}}"
  [[ -n "$user_id" ]] || die "no Camofox user_id found; pass one explicitly"
  if [[ -f "$env_file" ]]; then
    # shellcheck disable=SC1090
    . "$env_file"
  fi
  key="$(camofox_api_key "$(instance_dir "$name")")"
  [[ -n "$key" ]] || die "CAMOFOX_API_KEY missing from $(compose_file "$name"); redeploy this instance"

  compose_cmd "$name" exec -T camofox curl -fsS \
    -H "Authorization: Bearer ${key}" \
    "http://127.0.0.1:9377/sessions/${user_id}/storage_state" \
    -o /dev/null
  echo "Saved Camofox storage state for $user_id"
}

browser_save_best_effort() {
  local name="$1"
  if ! (browser_save "$name"); then
    echo "Warning: Camofox storage save failed before lifecycle action" >&2
  fi
}
