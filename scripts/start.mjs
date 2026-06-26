#!/usr/bin/env node
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const APP_ROOT = path.resolve(__dirname, "..");

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: APP_ROOT,
      env: { ...process.env, ...(options.env || {}) },
      stdio: options.stdio || "inherit",
    });
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} ${args.join(" ")} exited with ${code}`));
    });
  });
}

async function main() {
  await run("node", ["scripts/setup-baseline.mjs"]);
  await run("npm", ["run", "build"]);
  await run("npx", ["tsx", "server/index.ts"]);
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exit(1);
});
