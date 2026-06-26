# shellcheck shell=bash
# Sourced by bin/hermes-docker.

write_compose() {
  local name="$1"
  local dashboard_port="$2"
  local vnc_port="$3"
  local with_camofox="${4:-1}"
  local health_port="${5:-auto}"
  local web_port="${6:-auto}"
  local dir home workspace file h_image uid gid camofox_api_key camofox_image_value lan dashboard_auth_user dashboard_auth_password dashboard_auth_secret
  dir="$(instance_dir "$name")"
  home="$dir/home"
  workspace="$dir/workspace"
  file="$dir/compose.yaml"
  h_image="$(hermes_image)"
  uid="$(id -u)"
  gid="$(id -g)"
  lan="$(lan_ip)"
  web_port="$(free_port "$web_port" 9400 9499)"
  dashboard_auth_user="${HERMES_FLEET_DASHBOARD_AUTH_USERNAME:-fleet}"
  if [[ -f "$dir/instance.env" ]]; then
    dashboard_auth_password="$(awk -F= '$1=="HERMES_DASHBOARD_BASIC_AUTH_PASSWORD"{print substr($0, index($0, "=") + 1); exit}' "$dir/instance.env" 2>/dev/null || true)"
    dashboard_auth_secret="$(awk -F= '$1=="HERMES_DASHBOARD_BASIC_AUTH_SECRET"{print substr($0, index($0, "=") + 1); exit}' "$dir/instance.env" 2>/dev/null || true)"
  else
    dashboard_auth_password=""
    dashboard_auth_secret=""
  fi
  dashboard_auth_password="${dashboard_auth_password:-$(random_hex 24)}"
  dashboard_auth_secret="${dashboard_auth_secret:-$(random_hex 32)}"
  camofox_image_value=""
  if [[ "$with_camofox" == "1" ]]; then
    camofox_image_value="$CAMOFOX_IMAGE"
    camofox_api_key="$(camofox_api_key "$dir")"
    if [[ -z "$camofox_api_key" ]]; then
      camofox_api_key="$(python3 - <<'PY'
import secrets
print(secrets.token_hex(32))
PY
)"
    fi
  fi

  cat > "$file" <<YAML
name: hermes-${name}
services:
YAML

  cat >> "$file" <<YAML
  health:
    image: busybox:1.36
    restart: unless-stopped
    environment:
      HERMES_FLEET_AGENT_NAME: "${name}"
      HERMES_FLEET_HEALTH_PORT: "8080"
    command:
      - sh
      - -c
      - |
        mkdir -p /www
        printf '{"ok":true,"agent":"%s","service":"hermes-fleet-health"}\n' "\$\${HERMES_FLEET_AGENT_NAME}" > /www/health
        cp /www/health /www/index.html
        exec httpd -f -p 0.0.0.0:8080 -h /www
    ports:
      - "0.0.0.0:${health_port}:8080"
    healthcheck:
      test: ["CMD", "wget", "-qO-", "http://127.0.0.1:8080/health"]
      interval: 30s
      timeout: 5s
      start_period: 5s
      retries: 3

YAML

  if [[ "$with_camofox" == "1" ]]; then
    cat >> "$file" <<YAML
  camofox:
    image: ${CAMOFOX_IMAGE}
    restart: unless-stopped
    user: "${uid}:${gid}"
    env_file:
      - ${dir}/instance.env
    environment:
      HOME: /home/node
      XDG_CACHE_HOME: /home/node/.cache
      CAMOFOX_PORT: "9377"
      CAMOFOX_PROFILE_DIR: /data/profiles
      CAMOFOX_STABLE_LAUNCH_PROFILE: "true"
      CAMOFOX_CRASH_REPORT_ENABLED: "false"
      CAMOFOX_HEADLESS: "false"
      BROWSER_IDLE_TIMEOUT_MS: "86400000"
      CAMOFOX_PERSIST_INTERVAL_MS: "0"
      CAMOFOX_PERSIST_ACTIVITY_DEBOUNCE_MS: "0"
      ENABLE_VNC: "1"
      VNC_BIND: 0.0.0.0
      VNC_PORT: "5900"
      VNC_RESOLUTION: 1920x1080
      NOVNC_PORT: "6080"
    volumes:
      - ${home}/browser_auth/camofox/profiles:/data/profiles
      - ${home}/home/.cache/camoufox/addons:/home/node/.cache/camoufox/addons
    ports:
      - "${VNC_HOST_BIND}:${vnc_port}:6080"
    tmpfs:
      - /tmp
    healthcheck:
      test: ["CMD", "curl", "-fsS", "http://127.0.0.1:9377/health"]
      interval: 30s
      timeout: 5s
      start_period: 60s
      retries: 3

YAML
  fi

  cat >> "$file" <<YAML
  web:
    image: ${WEBHOST_IMAGE}
    restart: unless-stopped
    user: "${uid}:${gid}"
    environment:
      HERMES_WEB_ROOT: /opt/data/workspace/web
      HERMES_WEB_BIND: 0.0.0.0
      HERMES_WEB_CONTAINER_PORT: "4173"
    volumes:
      - ${workspace}:/opt/data/workspace
    ports:
      - "${WEB_HOST_BIND}:${web_port}:4173"
    healthcheck:
      test: ["CMD", "wget", "-qO-", "http://127.0.0.1:4173/health"]
      interval: 30s
      timeout: 5s
      start_period: 5s
      retries: 3

YAML

  cat >> "$file" <<YAML
  hermes:
    image: ${h_image}
    restart: unless-stopped
YAML

  if [[ "$with_camofox" == "1" ]]; then
    cat >> "$file" <<YAML
    depends_on:
      camofox:
        condition: service_healthy
YAML
  fi

  cat >> "$file" <<YAML
    env_file:
      - ${home}/.env
    environment:
      HERMES_HOME: /opt/data
      HERMES_UID: "${uid}"
      HERMES_GID: "${gid}"
      HERMES_DASHBOARD: "true"
      HERMES_DASHBOARD_HOST: 0.0.0.0
      HERMES_DASHBOARD_PORT: "9119"
      HERMES_DASHBOARD_BASIC_AUTH_USERNAME: "${dashboard_auth_user}"
      HERMES_DASHBOARD_BASIC_AUTH_PASSWORD: "${dashboard_auth_password}"
      HERMES_DASHBOARD_BASIC_AUTH_SECRET: "${dashboard_auth_secret}"
      HERMES_FLEET_AGENT_NAME: "${name}"
      HERMES_FLEET_CONSOLE_URL: http://host.docker.internal:5180
      HERMES_WEB_ROOT: /opt/data/workspace/web
      HERMES_WEB_PORT: "${web_port}"
      HERMES_WEB_URL: http://127.0.0.1:${web_port}
      HERMES_WEB_LAN_URL: http://${lan}:${web_port}
YAML

  if [[ "$with_camofox" == "1" ]]; then
    cat >> "$file" <<YAML
      CAMOFOX_URL: http://camofox:9377
      CAMOFOX_PROFILE_DIR: /opt/data/browser_auth/camofox/profiles
      CAMOFOX_CRASH_REPORT_ENABLED: "false"
YAML
  fi

  cat >> "$file" <<YAML
      MNEMOSYNE_DATA_DIR: /opt/data/mnemosyne/data
    volumes:
      - ${home}:/opt/data
      - ${workspace}:/opt/data/workspace
    ports:
      - "${DASHBOARD_HOST_BIND}:${dashboard_port}:9119"
    command: ["gateway", "run"]
YAML

  cat > "$dir/instance.env" <<EOF
NAME=$name
DASHBOARD_PORT=$dashboard_port
DASHBOARD_HOST_BIND=$DASHBOARD_HOST_BIND
HERMES_DASHBOARD_BASIC_AUTH_USERNAME=$dashboard_auth_user
HERMES_DASHBOARD_BASIC_AUTH_PASSWORD=$dashboard_auth_password
HERMES_DASHBOARD_BASIC_AUTH_SECRET=$dashboard_auth_secret
VNC_PORT=$vnc_port
HEALTH_PORT=$health_port
WEB_PORT=$web_port
VNC_HOST_BIND=$VNC_HOST_BIND
WEB_HOST_BIND=$WEB_HOST_BIND
HERMES_IMAGE=$h_image
HERMES_WEBHOST_IMAGE=$WEBHOST_IMAGE
CAMOFOX_ENABLED=$with_camofox
CAMOFOX_IMAGE=$camofox_image_value
CREATED_AT=$(date -u +%Y-%m-%dT%H:%M:%SZ)
EOF
  if [[ "$with_camofox" == "1" ]]; then
    printf 'CAMOFOX_API_KEY=%s\n' "$camofox_api_key" >> "$dir/instance.env"
  fi
  chmod 600 "$dir/instance.env"
}
