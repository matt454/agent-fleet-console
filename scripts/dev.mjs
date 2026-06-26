#!/usr/bin/env node
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const APP_ROOT = path.resolve(__dirname, "..");
const apiPort = process.env.HERMES_CONSOLE_API_PORT || process.env.HERMES_CONSOLE_PORT || "5180";
const devHost = process.env.HERMES_CONSOLE_DEV_HOST || "127.0.0.1";
const frontendPort = process.env.HERMES_CONSOLE_DEV_FRONTEND_PORT || "5200";

function runBlocking(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: APP_ROOT,
      env: process.env,
      stdio: "inherit",
    });
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} ${args.join(" ")} exited with ${code}`));
    });
  });
}

function spawnService(name, command, args, env = {}) {
  const child = spawn(command, args, {
    cwd: APP_ROOT,
    env: { ...process.env, ...env },
    stdio: "inherit",
  });
  child.on("exit", (code, signal) => {
    if (shuttingDown) return;
    console.error(`${name} exited${signal ? ` from ${signal}` : ` with ${code}`}`);
    shutdown(code || 1);
  });
  return child;
}

let shuttingDown = false;
const children = [];

function shutdown(code = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const child of children) {
    if (!child.killed) child.kill("SIGTERM");
  }
  setTimeout(() => process.exit(code), 250).unref();
}

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));

async function main() {
  await runBlocking("node", ["scripts/setup-baseline.mjs"]);
  children.push(spawnService("api", "npx", ["tsx", "server/index.ts"], {
    HERMES_CONSOLE_PORT: apiPort,
    HERMES_CONSOLE_API_PORT: apiPort,
    HERMES_CONSOLE_DEV_FRONTEND_URL: `http://localhost:${frontendPort}`,
  }));
  children.push(spawnService("frontend", "npx", ["vite", "--host", devHost], {
    HERMES_CONSOLE_API_PORT: apiPort,
    HERMES_CONSOLE_DEV_FRONTEND_PORT: frontendPort,
  }));
}

main().catch((error) => {
  console.error(error.stack || error.message);
  shutdown(1);
});
