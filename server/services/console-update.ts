import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { ALLOW_SELF_UPDATE, APP_ROOT, RESTART_COMMAND } from "../config.ts";

function shellQuote(value: string) {
  return `'${String(value).replace(/'/g, "'\\''")}'`;
}

export function startConsoleGitUpdateRestart() {
  if (!ALLOW_SELF_UPDATE) {
    const error = new Error("Console self-update is disabled. Set HERMES_CONSOLE_ALLOW_SELF_UPDATE=1 to enable it on this machine.") as Error & { status?: number };
    error.status = 403;
    throw error;
  }
  const logsDir = path.join(APP_ROOT, "logs");
  fs.mkdirSync(logsDir, { recursive: true });
  const logFile = path.join(logsDir, "console-git-update.log");
  const statusFile = path.join(logsDir, "console-git-update-status.json");
  const apiPid = process.pid;
  const parentPid = process.ppid;
  fs.writeFileSync(statusFile, JSON.stringify({
    status: "running",
    message: "Console update started",
    startedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    logFile,
  }, null, 2));
  const script = `
set -e
exec >> ${shellQuote(logFile)} 2>&1
export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:$PATH"
status_file=${shellQuote(statusFile)}
write_status() {
  printf '{"status":"%s","message":"%s","updatedAt":"%s","logFile":"%s"}\\n' "$1" "$2" "$(date -u +"%Y-%m-%dT%H:%M:%SZ")" ${shellQuote(logFile)} > "$status_file"
}
trap 'code=$?; write_status failed "Update failed with exit code $code"; exit $code' ERR
echo ""
echo "==== Fleet Console git update $(date -u +"%Y-%m-%dT%H:%M:%SZ") ===="
cd ${shellQuote(APP_ROOT)}
branch="$(git rev-parse --abbrev-ref HEAD)"
upstream="$(git rev-parse --abbrev-ref --symbolic-full-name '@{u}' 2>/dev/null || true)"
if [ -z "$upstream" ]; then upstream="origin/$branch"; fi
echo "branch=$branch upstream=$upstream"
git fetch --prune origin
git reset --hard "$upstream"
npm install
npm run build
echo "update complete; restarting console"
write_status complete "Console update complete"
if [ -n ${shellQuote(RESTART_COMMAND)} ]; then
  eval ${shellQuote(RESTART_COMMAND)}
else
  kill -TERM ${parentPid} 2>/dev/null || true
  kill -TERM ${apiPid} 2>/dev/null || true
  sleep 2
  nohup npm run dev >> ${shellQuote(logFile)} 2>&1 &
fi
`;
  const child = spawn("/bin/sh", ["-c", script], {
    cwd: APP_ROOT,
    detached: true,
    stdio: "ignore",
    env: process.env,
  });
  child.unref();
  return {
    ok: true,
    startedAt: new Date().toISOString(),
    logFile,
    restart: RESTART_COMMAND ? "custom" : "npm run dev",
  };
}

export function consoleGitUpdateStatus() {
  const logsDir = path.join(APP_ROOT, "logs");
  const logFile = path.join(logsDir, "console-git-update.log");
  const statusFile = path.join(logsDir, "console-git-update-status.json");
  let status: Record<string, any> = { status: "idle", message: "No console update has run", logFile };
  try {
    status = JSON.parse(fs.readFileSync(statusFile, "utf8"));
  } catch {
    // Keep the default idle status when no status file exists yet.
  }
  let tail = "";
  try {
    tail = fs.readFileSync(logFile, "utf8").split(/\r?\n/).slice(-120).join("\n");
  } catch {
    tail = "";
  }
  return { ...status, logTail: tail };
}
