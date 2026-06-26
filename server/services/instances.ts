import fs from "node:fs/promises";
import os from "node:os";
import { HERMES_DOCKER, ROOT, validators } from "../config.ts";
import { fileExists, parseEnv, readTextIfExists } from "../lib/env-file.ts";
import { run } from "../lib/process.ts";
import { composeArgs, composeFile, homeDir, instanceDir } from "./compose.ts";
import { readCapabilities, readConfig, readMemoryState, updateInfo } from "./instance-insights.ts";
import { instanceDisplayName } from "./instance-meta.ts";
import { recentEvents } from "./records.ts";
import { webInfoFromEnv } from "./web-hosting.ts";
import { isNemoClawInstance, nemoHermesSnapshot } from "./nemoclaw.ts";

export async function discoverInstanceNames() {
  await fs.mkdir(ROOT, { recursive: true });
  const entries = await fs.readdir(ROOT, { withFileTypes: true });
  const names = [];
  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name.startsWith(".")) continue;
    let name = "";
    try {
      name = validators.validateName(entry.name);
    } catch {
      continue;
    }
    const dir = instanceDir(name);
    const looksLikeAgent = await fileExists(`${dir}/nemoclaw.json`)
      || await fileExists(`${dir}/compose.yaml`)
      || (await fileExists(`${dir}/home`) && await fileExists(`${dir}/workspace`));
    if (looksLikeAgent) names.push(name);
  }
  return names;
}

async function instanceExists(name: string) {
  return fileExists(composeFile(name));
}

function servicePort(row: any, targetPort: number) {
  const publishers = Array.isArray(row.Publishers) ? row.Publishers : [];
  const match = publishers.find((item: any) => Number(item.TargetPort) === targetPort);
  return match ? Number(match.PublishedPort) : null;
}

async function composePs(name: string) {
  if (!await instanceExists(name)) return [];
  try {
    const { stdout } = await run("docker", composeArgs(name, "ps", "--format", "json"), { timeout: 15000 });
    return stdout.split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line));
  } catch {
    return [];
  }
}

function lanAddress() {
  for (const rows of Object.values(os.networkInterfaces())) {
    for (const row of rows || []) {
      if (row.family === "IPv4" && !row.internal) return row.address;
    }
  }
  return "127.0.0.1";
}

function localUrl(port: number | null, path = "") {
  if (!port) return "";
  return `http://127.0.0.1:${port}${path}`;
}

function lanUrl(port: number | null, lan: string, path = "") {
  if (!port) return "";
  const host = lan && lan !== "127.0.0.1" ? lan : "127.0.0.1";
  return `http://${host}:${port}${path}`;
}

async function endpointReachable(port: number | null, path = "/health") {
  if (!port) return false;
  try {
    const response = await fetch(`http://127.0.0.1:${port}${path}`, { signal: AbortSignal.timeout(1500) });
    return response.ok;
  } catch {
    return false;
  }
}

export async function dashboardPortForInstance(name: string) {
  const env = parseEnv(await readTextIfExists(`${instanceDir(name)}/instance.env`));
  if (Number(env.DASHBOARD_PORT)) return Number(env.DASHBOARD_PORT);
  const hermes = (await composePs(name)).find((row) => row.Service === "hermes");
  return servicePort(hermes || {}, 9119);
}

export async function instanceSnapshot(name: string, options: { refreshVersions?: boolean } = {}) {
  if (await isNemoClawInstance(name)) return nemoHermesSnapshot(name);
  const displayName = instanceDisplayName(name);
  const env = parseEnv(await readTextIfExists(`${instanceDir(name)}/instance.env`));
  const homeEnv = parseEnv(await readTextIfExists(`${homeDir(name)}/.env`));
  const agentEnv = { ...env, ...homeEnv };
  const services = await composePs(name);
  const config = await readConfig(name);
  const dashboard = Number(env.DASHBOARD_PORT) || servicePort(services.find((row) => row.Service === "hermes") || {}, 9119);
  const vnc = Number(env.VNC_PORT) || servicePort(services.find((row) => row.Service === "camofox") || {}, 6080);
  const health = Number(env.HEALTH_PORT) || servicePort(services.find((row) => row.Service === "hermes") || {}, 8080);
  const webPort = Number(env.WEB_PORT) || servicePort(services.find((row) => row.Service === "web") || {}, 4173);
  const lan = lanAddress();
  const web = webInfoFromEnv(name, { ...env, WEB_PORT: String(webPort || "") }, lan);
  const running = services.filter((row) => row.State === "running").length;
  const hasCompose = await instanceExists(name);
  const dependencies = { camofox: Boolean(vnc) };
  const memory = await readMemoryState(name, config);
  return {
    name,
    displayName,
    state: !hasCompose ? "unknown" : running === services.length && running > 0 ? "running" : running > 0 ? "partial" : "stopped",
    runtime: "docker",
    composeAvailable: hasCompose,
    services,
    serviceCount: services.length,
    runningServices: running,
    health: { dashboard: await endpointReachable(dashboard, "/api/status"), web: await endpointReachable(webPort), camofox: Boolean(vnc), activeTabs: null, activeSessions: null },
    endpoints: {
      dashboard: localUrl(dashboard),
      lanDashboard: lanUrl(dashboard, lan),
      vnc: localUrl(vnc, "/vnc.html"),
      lanVnc: lanUrl(vnc, lan, "/vnc.html"),
      web: web.localUrl,
      lanWeb: web.lanUrl,
    },
    ports: { dashboard, vnc, health, web: webPort },
    paths: { root: instanceDir(name), home: homeDir(name), compose: composeFile(name) },
    dependencies,
    network: { lanAddress: lan, healthPort: health },
    config,
    memory,
    capabilities: await readCapabilities(name, agentEnv, config, memory, dependencies),
    update: await updateInfo(env, { refresh: options.refreshVersions }),
    drift: { status: "unknown", summary: "Drift checks are not running" },
    timeline: recentEvents(name, 8),
  };
}

export async function listInstances(options: { refreshVersions?: boolean } = {}) {
  const names = await discoverInstanceNames();
  const snapshots = await Promise.all(names.map((name) => instanceSnapshot(name, options)));
  return snapshots.sort((a, b) => a.name.localeCompare(b.name));
}

export async function credentialSummaries(name: string) {
  const env = parseEnv(await readTextIfExists(`${homeDir(name)}/.env`));
  const credentials = Object.entries(env)
    .filter(([key]) => /TOKEN|SECRET|KEY|PASSWORD/i.test(key))
    .map(([key, value]) => ({
      key,
      redacted: value ? `${value.slice(0, 2)}...${value.slice(-2)}` : "",
      sensitive: true,
    }));
  return {
    credentials,
    requiredKeys: [],
    template: null,
  };
}

export async function runManager(args: string[], timeout: number) {
  return run(HERMES_DOCKER, args, { timeout, maxBuffer: 1024 * 1024 * 8 });
}
