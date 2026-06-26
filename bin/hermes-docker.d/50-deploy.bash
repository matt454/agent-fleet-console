# shellcheck shell=bash
# Sourced by bin/hermes-docker.

deploy() {
  local name="$1"
  shift
  require_name "$name"

  local from_profile="" from_workspace="" dashboard_port="auto" vnc_port="auto" health_port="auto" web_port="auto" with_camofox="1"
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --from-profile)
        from_profile="${2:-}"; shift 2 ;;
      --from-workspace)
        from_workspace="${2:-}"; shift 2 ;;
      --dashboard-port)
        dashboard_port="${2:-auto}"; shift 2 ;;
      --vnc-port)
        vnc_port="${2:-auto}"; shift 2 ;;
      --health-port)
        health_port="${2:-auto}"; shift 2 ;;
      --web-port)
        web_port="${2:-auto}"; shift 2 ;;
      --with-camofox)
        with_camofox="1"; shift ;;
      --without-camofox)
        with_camofox="0"; shift ;;
      *)
        die "unknown deploy option: $1" ;;
    esac
  done

  local dir home workspace selected_port selected_vnc_port selected_health_port selected_web_port camofox_user_id
  dir="$(instance_dir "$name")"
  home="$dir/home"
  workspace="$dir/workspace"
  selected_port="$(free_port "$dashboard_port" 9120 9219)"
  selected_health_port="$(free_port "$health_port" 9300 9399)"
  selected_web_port="$(free_port "$web_port" 9400 9499)"
  if [[ "$with_camofox" == "1" ]]; then
    selected_vnc_port="$(free_port "$vnc_port" 6080 6179)"
  else
    selected_vnc_port=""
  fi

  mkdir -p "$home" "$workspace"
  build_images "$with_camofox"

  if [[ -n "$from_profile" ]]; then
    copy_light_profile "$from_profile" "$home"
  else
    init_fresh_profile "$name" "$home" "$(default_camofox_user_id "$name")"
  fi
  sync_workspace "$from_workspace" "$workspace"

  if [[ -n "$from_profile" ]]; then
    rewrite_paths "$home" "$from_profile" "${from_workspace:-$workspace}"
  fi

  if [[ "$with_camofox" == "1" ]]; then
    set_env_value "$home/.env" "CAMOFOX_URL" "http://camofox:9377"
    set_env_value "$home/.env" "CAMOFOX_PROFILE_DIR" "/opt/data/browser_auth/camofox/profiles"
    set_env_value "$home/.env" "CAMOFOX_CRASH_REPORT_ENABLED" "false"
  else
    unset_env_value "$home/.env" "CAMOFOX_URL"
    unset_env_value "$home/.env" "CAMOFOX_PROFILE_DIR"
    unset_env_value "$home/.env" "CAMOFOX_CRASH_REPORT_ENABLED"
  fi
  ensure_mnemosyne_profile "$home"

  camofox_user_id="$(first_camofox_user_id "$home" || true)"
  camofox_user_id="${camofox_user_id:-$(configured_camofox_user_id "$home" || true)}"
  camofox_user_id="${camofox_user_id:-$(default_camofox_user_id "$name")}"
  if [[ -n "$from_profile" ]]; then
    patch_config "$home" "$from_profile" "${from_workspace:-$workspace}" "$camofox_user_id"
    ensure_mnemosyne_profile "$home"
  fi

  write_compose "$name" "$selected_port" "$selected_vnc_port" "$with_camofox" "$selected_health_port" "$selected_web_port"
  write_web_instructions "$name" "$selected_web_port"
  compose_cmd "$name" config >/dev/null

  echo "Deployed '$name'"
  echo "  Home:      $home"
  echo "  Workspace: $workspace"
  echo "  Compose:   $(compose_file "$name")"
  echo "  Dashboard: http://127.0.0.1:${selected_port}"
  echo "  Health:    http://$(lan_ip):${selected_health_port}/health"
  echo "  Web:       http://127.0.0.1:${selected_web_port}"
  echo "  LAN Web:   http://$(lan_ip):${selected_web_port}"
  if [[ "$with_camofox" == "1" ]]; then
    echo "  Camofox:   http://127.0.0.1:${selected_vnc_port}/vnc.html"
    echo "  LAN VNC:   http://$(lan_ip):${selected_vnc_port}/vnc.html"
  else
    echo "  Camofox:   disabled"
  fi
}

cutover() {
  local name="$1"
  require_name "$name"
  [[ "$name" == "veraxa" ]] || die "cutover currently only knows the old launchd labels for veraxa"

  local uid plist
  uid="$(id -u)"
  for plist in \
    /Users/matthew/Library/LaunchAgents/ai.hermes.gateway-veraxa.plist \
    /Users/matthew/Library/LaunchAgents/com.hermes.veraxa.camofox.plist
  do
    if [[ -f "$plist" ]]; then
      echo "Stopping launchd service from $plist"
      launchctl bootout "gui/${uid}" "$plist" 2>/dev/null || true
    fi
  done
  compose_cmd "$name" up -d
  echo "Cutover complete for '$name'"
}
