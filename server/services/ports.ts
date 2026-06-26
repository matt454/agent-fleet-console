import fs from "node:fs/promises";
import net from "node:net";
import path from "node:path";
import { ROOT, validators } from "../config.ts";
import { parseEnv, readTextIfExists } from "../lib/env-file.ts";

const RANGES = {
  dashboard: [9120, 9219],
  health: [9300, 9399],
  web: [9400, 9499],
  vnc: [6080, 6179],
};

async function usedFleetPorts() {
  const used = new Set<number>();
  let entries: any[] = [];
  try {
    entries = await fs.readdir(ROOT, { withFileTypes: true });
  } catch {
    return used;
  }
  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name.startsWith(".")) continue;
    try {
      validators.validateName(entry.name);
    } catch {
      continue;
    }
    const env = parseEnv(await readTextIfExists(path.join(ROOT, entry.name, "instance.env")));
    for (const key of ["DASHBOARD_PORT", "HEALTH_PORT", "WEB_PORT", "VNC_PORT"]) {
      const port = Number(env[key]);
      if (port) used.add(port);
    }
  }
  return used;
}

function canListen(port: number) {
  return new Promise<boolean>((resolve) => {
    const server = net.createServer();
    server.once("error", () => resolve(false));
    server.listen(port, "127.0.0.1", () => server.close(() => resolve(true)));
  });
}

async function pickPort(start: number, end: number, used: Set<number>) {
  for (let port = start; port <= end; port += 1) {
    if (used.has(port)) continue;
    if (await canListen(port)) {
      used.add(port);
      return port;
    }
  }
  throw new Error(`No free port in range ${start}-${end}`);
}

export async function allocateInstancePorts(camofox = true) {
  const used = await usedFleetPorts();
  const dashboard = await pickPort(RANGES.dashboard[0], RANGES.dashboard[1], used);
  const health = await pickPort(RANGES.health[0], RANGES.health[1], used);
  const web = await pickPort(RANGES.web[0], RANGES.web[1], used);
  const vnc = camofox ? await pickPort(RANGES.vnc[0], RANGES.vnc[1], used) : null;
  return { dashboard, health, web, vnc };
}
