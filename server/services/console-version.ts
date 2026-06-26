import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { APP_ROOT } from "../config.ts";

function packageVersion() {
  try {
    const packageJson = JSON.parse(fs.readFileSync(path.join(APP_ROOT, "package.json"), "utf8"));
    return typeof packageJson.version === "string" ? packageJson.version : "";
  } catch {
    return "";
  }
}

function gitRevision() {
  try {
    return execFileSync("git", ["rev-parse", "--short=12", "HEAD"], {
      cwd: APP_ROOT,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return "";
  }
}

export function consoleVersion() {
  const version = packageVersion();
  const revision = gitRevision();
  const label = [version ? `v${version}` : "", revision].filter(Boolean).join(" · ");
  return {
    version,
    revision,
    label: label || "Unknown",
  };
}
