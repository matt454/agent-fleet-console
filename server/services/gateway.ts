import { camofoxDiagnosticsForInstance } from "./camofox-diagnostics.ts";
import { diagnoseGatewayEndpoints } from "./gateway-diagnostics.ts";
import { instanceSnapshot } from "./instances.ts";
import { parseEnv, readTextIfExists } from "../lib/env-file.ts";
import { homeDir, instanceDir } from "./compose.ts";

function proxyFields(endpoints: any) {
  return {
    dashboardUrl: endpoints.dashboard,
    lanDashboardUrl: endpoints.lanDashboard,
    vncUrl: endpoints.vnc,
    webUrl: endpoints.web,
    lanWebUrl: endpoints.lanWeb,
  };
}

export function dashboardAuthFromEnv(env: Record<string, string>) {
  const username = env.HERMES_DASHBOARD_BASIC_AUTH_USERNAME || "fleet";
  const password = env.HERMES_DASHBOARD_BASIC_AUTH_PASSWORD || "";
  return {
    username,
    password,
    available: Boolean(password),
    reason: password ? "" : "password_unavailable",
    source: password ? "instance.env" : "default_username",
  };
}

async function dashboardAuthForInstance(name: string) {
  const env = {
    ...parseEnv(await readTextIfExists(`${homeDir(name)}/.env`)),
    ...parseEnv(await readTextIfExists(`${instanceDir(name)}/instance.env`)),
  };
  return dashboardAuthFromEnv(env);
}

export async function gatewayResponseForInstance(name: string) {
  const instance = await instanceSnapshot(name);
  const runtime: Record<string, unknown> = {};
  if (instance.dependencies?.camofox) runtime.camofox = await camofoxDiagnosticsForInstance(name);
  const diagnostics = await diagnoseGatewayEndpoints(instance.endpoints, {
    nodeId: "local",
    nodeLocal: true,
    nodeReportedHealth: instance.health,
    remoteUpdate: instance.update,
    terminalReachable: ["running", "partial"].includes(instance.state),
    runtime,
  });
  return {
    ...instance.endpoints,
    proxy: proxyFields(instance.endpoints),
    dashboardAuth: await dashboardAuthForInstance(name),
    dashboardUnavailable: diagnostics.dashboard.reachable === false,
    diagnostics,
  };
}
