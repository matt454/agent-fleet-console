import type { GatewayDiagnostics, GatewaySurface } from "../models/fleet.ts";

type PreferredGatewayUrlOptions = {
  nodeLocal: boolean;
  localUrl?: string;
  lanUrl?: string;
  fallbackUrl?: string;
  consoleHostname?: string;
};

function reasonLabel(reason = "") {
  switch (reason) {
    case "connection_refused":
      return "port refused";
    case "timeout":
      return "timed out";
    case "auth_required":
      return "authentication required";
    case "missing":
      return "not advertised";
    case "ok":
      return "available";
    default:
      return reason.replace(/^http_/, "HTTP ").replace(/_/g, " ") || "not reachable";
  }
}

export function dashboardFallbackMessage(diagnostics: GatewayDiagnostics | undefined, vncAvailable: boolean) {
  const dashboard = diagnostics?.dashboard;
  if (!dashboard || dashboard.reachable) return "";
  if (dashboard.reason === "connection_refused" && vncAvailable) return "Dashboard port refused from this console; VNC is available.";
  if (vncAvailable) return `Dashboard ${reasonLabel(dashboard.reason)} from this console; VNC is available.`;
  return `Dashboard ${reasonLabel(dashboard.reason)} from this console.`;
}

export function surfaceStatusLabel(diagnostics: GatewayDiagnostics | undefined, surface: GatewaySurface) {
  const diagnostic = diagnostics?.[surface];
  if (!diagnostic) return "";
  return diagnostic.reachable ? "Reachable" : reasonLabel(diagnostic.reason);
}

function isLoopbackHostname(hostname = "") {
  return ["localhost", "127.0.0.1", "::1", "[::1]", "0.0.0.0"].includes(hostname);
}

export function preferredGatewayUrl({
  nodeLocal,
  localUrl = "",
  lanUrl = "",
  fallbackUrl = "",
  consoleHostname = globalThis.location?.hostname || "",
}: PreferredGatewayUrlOptions) {
  const local = localUrl || fallbackUrl;
  const lan = lanUrl || fallbackUrl;
  if (nodeLocal && isLoopbackHostname(consoleHostname)) return local || lan;
  return lan || local;
}
