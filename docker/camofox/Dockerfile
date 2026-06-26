FROM node:22-bookworm-slim

ARG CAMOFOX_BROWSER_VERSION=1.11.2
ARG CAMOUFOX_VERSION=135.0.1
ARG CAMOUFOX_RELEASE=beta.24
ARG TARGETARCH

ENV NODE_ENV=production \
    PNPM_HOME=/usr/local/share/pnpm \
    PATH=/usr/local/share/pnpm:$PATH \
    CAMOFOX_PORT=9377 \
    CAMOFOX_PROFILE_DIR=/data/profiles \
    CAMOFOX_CRASH_REPORT_ENABLED=false \
    CAMOFOX_HEADLESS=false \
    HOME=/home/node \
    XDG_CACHE_HOME=/home/node/.cache

RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    curl \
    fontconfig \
    fonts-liberation \
    fonts-noto-color-emoji \
    libasound2 \
    libdbus-glib-1-2 \
    libegl1-mesa \
    libgbm1 \
    libgl1-mesa-dri \
    libgtk-3-0 \
    libx11-xcb1 \
    libxcomposite1 \
    libxcursor1 \
    libxdamage1 \
    libxfixes3 \
    libxi6 \
    libxrandr2 \
    libxrender1 \
    libxss1 \
    libxt6 \
    libxtst6 \
    procps \
    python3-minimal \
    unzip \
    xvfb \
    && rm -rf /var/lib/apt/lists/*

RUN apt-get update && \
    apt-get install -y --no-install-recommends g++ make pkg-config && \
    corepack enable && \
    corepack prepare pnpm@10.24.0 --activate && \
    CAMOFOX_SKIP_DOWNLOAD=1 pnpm add -g "@askjo/camofox-browser@${CAMOFOX_BROWSER_VERSION}" && \
    better_sqlite_dir="$(find "${PNPM_HOME}/global/5/.pnpm" -maxdepth 1 -type d -name 'better-sqlite3@*' | head -n 1)/node_modules/better-sqlite3" && \
    npm --prefix "$better_sqlite_dir" run install && \
    pnpm store prune && \
    apt-get purge -y --auto-remove g++ make pkg-config && \
    rm -rf /var/lib/apt/lists/*

RUN set -eux; \
    case "${TARGETARCH:-$(dpkg --print-architecture)}" in \
      amd64) CAMOUFOX_ARCH="x86_64"; YTDLP_SUFFIX="" ;; \
      arm64) CAMOUFOX_ARCH="arm64"; YTDLP_SUFFIX="_aarch64" ;; \
      *) echo "Unsupported arch: ${TARGETARCH:-$(dpkg --print-architecture)}" >&2; exit 1 ;; \
    esac; \
    mkdir -p "${HOME}/.cache/camoufox" /data/profiles /home/node; \
    curl -fSL "https://github.com/daijro/camoufox/releases/download/v${CAMOUFOX_VERSION}-${CAMOUFOX_RELEASE}/camoufox-${CAMOUFOX_VERSION}-${CAMOUFOX_RELEASE}-lin.${CAMOUFOX_ARCH}.zip" \
      -o /tmp/camoufox.zip; \
    (unzip -q /tmp/camoufox.zip -d "${HOME}/.cache/camoufox" || true); \
    echo "{\"version\":\"${CAMOUFOX_VERSION}\",\"release\":\"${CAMOUFOX_RELEASE}\"}" > "${HOME}/.cache/camoufox/version.json"; \
    test -f "${HOME}/.cache/camoufox/camoufox-bin"; \
    curl -fSL "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_linux${YTDLP_SUFFIX}" \
      -o /usr/local/bin/yt-dlp; \
    chmod 755 /usr/local/bin/yt-dlp; \
    rm -f /tmp/camoufox.zip; \
    chmod -R a+rwX "${HOME}"; \
    chown -R node:node /data /home/node

RUN apt-get update && apt-get install -y --no-install-recommends \
    net-tools \
    novnc \
    python3-websockify \
    x11vnc \
    && rm -rf /var/lib/apt/lists/*

RUN node -e "\
const fs = require('fs'); \
const path = '/usr/local/share/pnpm/global/5/node_modules/@askjo/camofox-browser/camofox.config.json'; \
const config = JSON.parse(fs.readFileSync(path, 'utf8')); \
config.plugins = config.plugins || {}; \
config.plugins.vnc = { ...(config.plugins.vnc || {}), enabled: true, resolution: '1920x1080', novncPort: 6080, vncPort: 5900 }; \
fs.writeFileSync(path, JSON.stringify(config, null, 2) + '\n');"

COPY patch-camofox.py /tmp/patch-camofox.py
RUN python3 /tmp/patch-camofox.py && rm /tmp/patch-camofox.py

RUN chmod 1777 /var/log

USER node
WORKDIR /home/node

EXPOSE 9377 6080

HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
    CMD curl -fsS "http://127.0.0.1:${CAMOFOX_PORT}/health" >/dev/null || exit 1

CMD ["camofox-browser"]
