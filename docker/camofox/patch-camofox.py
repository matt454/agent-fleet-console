#!/usr/bin/env python3
from pathlib import Path


ROOT = Path("/usr/local/share/pnpm/global/5/node_modules/@askjo/camofox-browser")


def patch_once(path: Path, old: str, new: str) -> None:
    text = path.read_text()
    if new in text:
        return
    if old not in text:
        raise SystemExit(f"patch target not found in {path}: {old[:80]!r}")
    path.write_text(text.replace(old, new, 1))


patch_once(
    ROOT / "server.js",
    "  // Reset native memory baseline so next browser measures from fresh\n"
    "  reporter.resetNativeMemBaseline();\n"
    "  _nativeMemBaseline = null;\n",
    "  // Reset native memory baseline so next browser measures from fresh\n"
    "  if (typeof reporter.resetNativeMemBaseline === 'function') {\n"
    "    reporter.resetNativeMemBaseline();\n"
    "  }\n"
    "  _nativeMemBaseline = null;\n",
)

patch_once(
    ROOT / "server.js",
    "function getExternalCamoufoxLaunch() {\n",
    "function applyStableLaunchProfile(options) {\n"
    "  if (process.env.CAMOFOX_STABLE_LAUNCH_PROFILE === 'false') return options;\n"
    "  if (!CONFIG.profileDir) return options;\n"
    "  const root = String(CONFIG.profileDir).replace(/\\/+$/, '');\n"
    "  const statePath = `${root}/browser-launch-state.json`;\n"
    "  const addonSignature = () => {\n"
    "    const addonRoot = '/home/node/.cache/camoufox/addons';\n"
    "    try {\n"
    "      return fs.readdirSync(addonRoot, { withFileTypes: true })\n"
    "        .filter((entry) => entry.isDirectory())\n"
    "        .map((entry) => {\n"
    "          const manifest = `${addonRoot}/${entry.name}/manifest.json`;\n"
    "          let mtime = 0;\n"
    "          try { mtime = fs.statSync(manifest).mtimeMs; } catch {}\n"
    "          return `${entry.name}:${mtime}`;\n"
    "        })\n"
    "        .sort()\n"
    "        .join('|');\n"
    "    } catch {\n"
    "      return '';\n"
    "    }\n"
    "  };\n"
    "  const capture = () => ({\n"
    "    addonSignature: addonSignature(),\n"
    "    env: Object.fromEntries(\n"
    "      Object.entries(options.env || {}).filter(([key]) => key.startsWith('CAMOU_CONFIG_') || key === 'FONTCONFIG_PATH')\n"
    "    ),\n"
    "    firefoxUserPrefs: options.firefoxUserPrefs || {},\n"
    "  });\n"
    "  try {\n"
    "    fs.mkdirSync(root, { recursive: true });\n"
    "    if (fs.existsSync(statePath)) {\n"
    "      const state = JSON.parse(fs.readFileSync(statePath, 'utf8'));\n"
    "      if ((state.addonSignature || '') === addonSignature()) {\n"
    "        options.env = { ...(options.env || {}), ...(state.env || {}) };\n"
    "        options.firefoxUserPrefs = { ...(options.firefoxUserPrefs || {}), ...(state.firefoxUserPrefs || {}) };\n"
    "        log('info', 'restored stable camoufox launch profile', { path: statePath });\n"
    "      } else {\n"
    "        fs.writeFileSync(statePath, JSON.stringify(capture(), null, 2));\n"
    "        log('info', 'refreshed stable camoufox launch profile after addon change', { path: statePath });\n"
    "      }\n"
    "    } else {\n"
    "      fs.writeFileSync(statePath, JSON.stringify(capture(), null, 2));\n"
    "      log('info', 'saved stable camoufox launch profile', { path: statePath });\n"
    "    }\n"
    "  } catch (err) {\n"
    "    log('warn', 'stable camoufox launch profile failed', { path: statePath, error: err.message });\n"
    "  }\n"
    "  return options;\n"
    "}\n\n"
    "function getExternalCamoufoxLaunch() {\n",
)

patch_once(
    ROOT / "server.js",
    "      options.proxy = normalizePlaywrightProxy(options.proxy);\n"
    "      await pluginEvents.emitAsync('browser:launching', { options });\n",
    "      options.proxy = normalizePlaywrightProxy(options.proxy);\n"
    "      applyStableLaunchProfile(options);\n"
    "      await pluginEvents.emitAsync('browser:launching', { options });\n",
)

patch_once(
    ROOT / "server.js",
    "  pluginEvents.emit('server:shutdown', { signal });\n\n"
    "  const forceTimeout = setTimeout(() => {\n",
    "  await pluginEvents.emitAsync('server:shutdown', { signal });\n\n"
    "  const forceTimeout = setTimeout(() => {\n",
)

persistence = ROOT / "plugins/persistence/index.js"
patch_once(
    persistence,
    "  log('info', 'persistence plugin enabled', { profileDir });\n\n"
    "  // Track active sessions for checkpoint on close\n"
    "  const activeSessions = new Map(); // userId -> context\n",
    "  log('info', 'persistence plugin enabled', { profileDir });\n\n"
    "  const autoCheckpointIntervalMs = Math.max(\n"
    "    0,\n"
    "    Number.parseInt(process.env.CAMOFOX_PERSIST_INTERVAL_MS || pluginConfig.autoCheckpointIntervalMs || '0', 10) || 0\n"
    "  );\n"
    "  const activityCheckpointDelayMs = Math.max(\n"
    "    0,\n"
    "    Number.parseInt(process.env.CAMOFOX_PERSIST_ACTIVITY_DEBOUNCE_MS || pluginConfig.activityCheckpointDelayMs || '0', 10) || 0\n"
    "  );\n\n"
    "  // Track active sessions for checkpoint on close\n"
    "  const activeSessions = new Map(); // userId -> context\n",
)
patch_once(
    persistence,
    "  async function checkpoint(userId, context, reason) {\n"
    "    if (!context) return;\n"
    "    const result = await persistStorageState({ profileDir, userId, context, logger });\n"
    "    if (result.persisted) {\n"
    "      log('info', 'storage state persisted', { userId, reason, path: result.storageStatePath });\n"
    "    }\n"
    "    return result;\n"
    "  }\n\n"
    "  // --- Lifecycle hooks ---\n",
    "  async function checkpoint(userId, context, reason) {\n"
    "    if (!context) return;\n"
    "    const result = await persistStorageState({ profileDir, userId, context, logger });\n"
    "    if (result.persisted) {\n"
    "      log('info', 'storage state persisted', { userId, reason, path: result.storageStatePath });\n"
    "    }\n"
    "    return result;\n"
    "  }\n\n"
    "  const activityCheckpointTimers = new Map();\n"
    "  function scheduleActivityCheckpoint(userId, reason) {\n"
    "    if (!activityCheckpointDelayMs || !userId) return;\n"
    "    const key = String(userId);\n"
    "    const existing = activityCheckpointTimers.get(key);\n"
    "    if (existing) clearTimeout(existing);\n"
    "    const timer = setTimeout(async () => {\n"
    "      activityCheckpointTimers.delete(key);\n"
    "      const context = activeSessions.get(key);\n"
    "      if (context) await checkpoint(key, context, reason).catch(() => {});\n"
    "    }, activityCheckpointDelayMs);\n"
    "    timer.unref?.();\n"
    "    activityCheckpointTimers.set(key, timer);\n"
    "  }\n\n"
    "  let autoCheckpointTimer = null;\n"
    "  if (autoCheckpointIntervalMs > 0) {\n"
    "    autoCheckpointTimer = setInterval(async () => {\n"
    "      for (const [userId, context] of activeSessions) {\n"
    "        await checkpoint(userId, context, 'autosave').catch(() => {});\n"
    "      }\n"
    "    }, autoCheckpointIntervalMs);\n"
    "    autoCheckpointTimer.unref?.();\n"
    "    log('info', 'persistence autosave enabled', { intervalMs: autoCheckpointIntervalMs });\n"
    "  }\n\n"
    "  if (activityCheckpointDelayMs > 0) {\n"
    "    log('info', 'persistence activity checkpoint enabled', { delayMs: activityCheckpointDelayMs });\n"
    "  }\n\n"
    "  // --- Lifecycle hooks ---\n",
)
patch_once(
    persistence,
    "  // On cookie import: checkpoint\n"
    "  events.on('session:cookies:import', async ({ userId }) => {\n",
    "  for (const eventName of ['tab:created', 'tab:navigated', 'tab:click', 'tab:type', 'tab:press']) {\n"
    "    events.on(eventName, ({ userId }) => scheduleActivityCheckpoint(userId, eventName));\n"
    "  }\n\n"
    "  // On cookie import: checkpoint\n"
    "  events.on('session:cookies:import', async ({ userId }) => {\n",
)
patch_once(
    persistence,
    "      await checkpoint(userId, context, reason).catch(() => {});\n"
    "      activeSessions.delete(userId);\n"
    "    }\n"
    "  });\n\n"
    "  // On session destroyed (post-close): cleanup tracking if not already done\n"
    "  events.on('session:destroyed', async ({ userId }) => {\n"
    "    activeSessions.delete(userId);\n"
    "  });\n",
    "      await checkpoint(userId, context, reason).catch(() => {});\n"
    "      activeSessions.delete(userId);\n"
    "    }\n"
    "    const timer = activityCheckpointTimers.get(String(userId));\n"
    "    if (timer) clearTimeout(timer);\n"
    "    activityCheckpointTimers.delete(String(userId));\n"
    "  });\n\n"
    "  // On session destroyed (post-close): cleanup tracking if not already done\n"
    "  events.on('session:destroyed', async ({ userId }) => {\n"
    "    activeSessions.delete(userId);\n"
    "    const timer = activityCheckpointTimers.get(String(userId));\n"
    "    if (timer) clearTimeout(timer);\n"
    "    activityCheckpointTimers.delete(String(userId));\n"
    "  });\n",
)
patch_once(
    persistence,
    "  events.on('server:shutdown', async () => {\n"
    "    for (const [userId, context] of activeSessions) {\n",
    "  events.on('server:shutdown', async () => {\n"
    "    if (autoCheckpointTimer) clearInterval(autoCheckpointTimer);\n"
    "    for (const timer of activityCheckpointTimers.values()) clearTimeout(timer);\n"
    "    activityCheckpointTimers.clear();\n"
    "    for (const [userId, context] of activeSessions) {\n",
)

patch_once(
    ROOT / "server.js",
    "        localVirtualDisplay = pluginCtx.createVirtualDisplay();\n"
    "        vdDisplay = localVirtualDisplay.get();\n"
    "        log('info', 'xvfb virtual display started', { display: vdDisplay, attempt });\n",
    "        localVirtualDisplay = pluginCtx.createVirtualDisplay();\n"
    "        vdDisplay = await localVirtualDisplay.get();\n"
    "        log('info', 'xvfb virtual display started', { display: vdDisplay, attempt });\n",
)

patch_once(
    ROOT / "plugins/vnc/vnc-watcher.sh",
    "websockify --web \"$NOVNC_DIR\" \"$VNC_BIND:$NOVNC_PORT\" \"127.0.0.1:$VNC_PORT\" >/var/log/novnc.log 2>&1 &\n",
    "if ! pgrep -f \"websockify.*:$NOVNC_PORT\" >/dev/null 2>&1; then\n"
    "  websockify --web \"$NOVNC_DIR\" \"$VNC_BIND:$NOVNC_PORT\" \"127.0.0.1:$VNC_PORT\" >/var/log/novnc.log 2>&1 &\n"
    "fi\n",
)

patch_once(
    ROOT / "plugins/vnc/vnc-watcher.sh",
    "  # Find Xvfb with our patched resolution\n"
    "  FOUND=$(ps -eo args= 2>/dev/null | awk -v res=\"$VNC_RESOLUTION\" '\n"
    "    /\\/Xvfb :[0-9]+/ && index($0, res) {\n"
    "      for (i=1;i<=NF;i++) if ($i ~ /^:[0-9]+$/) { print $i; exit }\n"
    "    }\n"
    "  ' | head -1)\n",
    "  # Find the active X socket. Playwright's Xvfb commonly uses -displayfd,\n"
    "  # so the display number may not appear in the process arguments.\n"
    "  FOUND=$(find /tmp/.X11-unix -maxdepth 1 -type s -name 'X[0-9]*' 2>/dev/null \\\n"
    "    | sed 's#^.*/X#:#' \\\n"
    "    | sort -V \\\n"
    "    | head -1)\n",
)
