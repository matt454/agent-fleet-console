import { spawnSync } from "node:child_process";
import path from "node:path";
import { APP_ROOT } from "../config.ts";

export function baselineStatus() {
  const result = spawnSync("node", [path.join(APP_ROOT, "scripts", "init-baseline.mjs"), "--json"], {
    cwd: APP_ROOT,
    encoding: "utf8",
    maxBuffer: 1024 * 1024 * 4,
  });
  const text = result.stdout || "{}";
  try {
    return JSON.parse(text);
  } catch {
    return {
      ok: false,
      appRoot: APP_ROOT,
      loadedEnvFiles: [],
      resolved: {},
      checks: [],
      errors: [{ ok: false, label: "Baseline check", detail: "Unable to parse setup output", fix: result.stderr || "Run npm run init:baseline -- --json.", severity: "error" }],
      warnings: [],
    };
  }
}
