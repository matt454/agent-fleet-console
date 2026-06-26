type GatewaySurface = "dashboard" | "vnc" | "web" | "terminal" | "chatHistory";

export type GatewaySurfaceDiagnostic = {
  advertisedUrl: string;
  effectiveUrl: string;
  reachable: boolean;
  httpStatus: number | null;
  reason: string;
  checkedAt: string;
};

export type GatewayDiagnostics = Record<GatewaySurface, GatewaySurfaceDiagnostic> & {
  checkedAt: string;
  hints: string[];
  remote?: Record<string, unknown>;
  runtime?: Record<string, unknown>;
};

type FetchLike = (input: string | URL, init?: RequestInit) => Promise<{ ok: boolean; status: number }>;

type DiagnoseOptions = {
  checkedAt?: string;
  fetchImpl?: FetchLike;
  timeoutMs?: number;
  terminalReachable?: boolean;
  nodeId?: string;
  nodeBaseUrl?: string;
  nodeLocal?: boolean;
  nodeReportedHealth?: Record<string, any>;
  remoteUpdate?: Record<string, any>;
  remoteDiagnostics?: Record<string, any>;
  runtime?: Record<string, unknown>;
};

const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "[::1]", "0.0.0.0"]);

function isLoopbackHost(hostname: string) {
  return LOOPBACK_HOSTS.has(hostname);
}

function nodeHost(node: any) {
  try {
    return new URL(node.baseUrl || node.base_url || "").hostname;
  } catch {
    return "";
  }
}

function replaceLoopbackHost(url: string, host: string) {
  if (!url || !host) return url;
  try {
    const parsed = new URL(url);
    if (!isLoopbackHost(parsed.hostname)) return url;
    parsed.hostname = host;
    return parsed.toString();
  } catch {
    return url;
  }
}

export function normalizeRemoteGatewayEndpoints(endpoints: any = {}, node: any = {}) {
  if (node.local) return endpoints || {};
  const host = nodeHost(node);
  return {
    ...endpoints,
    lanDashboard: endpoints.lanDashboard || replaceLoopbackHost(endpoints.dashboard || "", host),
    lanVnc: endpoints.lanVnc || replaceLoopbackHost(endpoints.vnc || "", host),
    lanWeb: endpoints.lanWeb || replaceLoopbackHost(endpoints.web || "", host),
  };
}

export function normalizeRemoteInstanceEndpoints(instance: any, node: any) {
  if (node.local) return instance;
  return {
    ...instance,
    endpoints: normalizeRemoteGatewayEndpoints(instance?.endpoints || {}, node),
  };
}

function diagnostic(advertisedUrl: string, effectiveUrl: string, reachable: boolean, httpStatus: number | null, reason: string, checkedAt: string): GatewaySurfaceDiagnostic {
  return { advertisedUrl: advertisedUrl || "", effectiveUrl: effectiveUrl || "", reachable, httpStatus, reason, checkedAt };
}

function classifyFetchError(error: any) {
  const code = String(error?.cause?.code || error?.code || "");
  const text = String(error?.message || error || "");
  if (/ECONNREFUSED/i.test(code) || /ECONNREFUSED|connection refused/i.test(text)) return "connection_refused";
  if (/AbortError|TimeoutError|ETIMEDOUT|timed out|timeout/i.test(code) || /AbortError|TimeoutError|ETIMEDOUT|timed out|timeout/i.test(text)) return "timeout";
  if (/ENOTFOUND|EAI_AGAIN/i.test(code) || /ENOTFOUND|EAI_AGAIN|name not resolved/i.test(text)) return "dns_error";
  if (/ECONNRESET/i.test(code) || /ECONNRESET|socket hang up/i.test(text)) return "connection_reset";
  if (/invalid url/i.test(text)) return "invalid_url";
  return "fetch_failed";
}

function probeTarget(effectiveUrl: string, path = "") {
  if (!effectiveUrl) return "";
  try {
    if (!path) return new URL(effectiveUrl).toString();
    return new URL(path, effectiveUrl.endsWith("/") ? effectiveUrl : `${effectiveUrl}/`).toString();
  } catch {
    return "";
  }
}

export async function probeGatewaySurface({
  advertisedUrl,
  effectiveUrl,
  path = "",
  checkedAt = new Date().toISOString(),
  fetchImpl = fetch as FetchLike,
  timeoutMs = 2500,
}: {
  advertisedUrl: string;
  effectiveUrl: string;
  path?: string;
  checkedAt?: string;
  fetchImpl?: FetchLike;
  timeoutMs?: number;
}) {
  const target = probeTarget(effectiveUrl, path);
  if (!target) return diagnostic(advertisedUrl, effectiveUrl, false, null, effectiveUrl ? "invalid_url" : "missing", checkedAt);
  try {
    const response = await fetchImpl(target, { redirect: "manual", signal: AbortSignal.timeout(timeoutMs) });
    if (response.ok) return diagnostic(advertisedUrl, effectiveUrl, true, response.status, "ok", checkedAt);
    if (response.status === 401 || response.status === 403) return diagnostic(advertisedUrl, effectiveUrl, true, response.status, "auth_required", checkedAt);
    return diagnostic(advertisedUrl, effectiveUrl, false, response.status, `http_${response.status}`, checkedAt);
  } catch (error) {
    return diagnostic(advertisedUrl, effectiveUrl, false, null, classifyFetchError(error), checkedAt);
  }
}

function pushHint(hints: string[], hint: string) {
  if (hint && !hints.includes(hint)) hints.push(hint);
}

function runtimeHints(runtime: Record<string, any> | undefined) {
  const hints: string[] = [];
  const camofox = runtime?.camofox;
  for (const hint of camofox?.hints || []) pushHint(hints, hint);
  return hints;
}

export async function diagnoseGatewayEndpoints(endpoints: any = {}, options: DiagnoseOptions = {}): Promise<GatewayDiagnostics> {
  const checkedAt = options.checkedAt || new Date().toISOString();
  const fetchImpl = options.fetchImpl || fetch as FetchLike;
  const preferLocal = options.nodeLocal === true;
  const dashboardAdvertised = endpoints.dashboard || endpoints.lanDashboard || "";
  const dashboardEffective = preferLocal ? endpoints.dashboard || endpoints.lanDashboard || "" : endpoints.lanDashboard || endpoints.dashboard || "";
  const vncAdvertised = endpoints.vnc || endpoints.lanVnc || "";
  const vncEffective = preferLocal ? endpoints.vnc || endpoints.lanVnc || "" : endpoints.lanVnc || endpoints.vnc || "";
  const webAdvertised = endpoints.web || endpoints.lanWeb || "";
  const webEffective = preferLocal ? endpoints.web || endpoints.lanWeb || "" : endpoints.lanWeb || endpoints.web || "";

  const [dashboard, vnc, web] = await Promise.all([
    probeGatewaySurface({ advertisedUrl: dashboardAdvertised, effectiveUrl: dashboardEffective, path: "/api/status", checkedAt, fetchImpl, timeoutMs: options.timeoutMs }),
    probeGatewaySurface({ advertisedUrl: vncAdvertised, effectiveUrl: vncEffective, checkedAt, fetchImpl, timeoutMs: options.timeoutMs }),
    probeGatewaySurface({ advertisedUrl: webAdvertised, effectiveUrl: webEffective, checkedAt, fetchImpl, timeoutMs: options.timeoutMs }),
  ]);
  const terminal = diagnostic("", "", options.terminalReachable !== false, null, options.terminalReachable === false ? "agent_not_running" : "ok", checkedAt);
  const chatHistory = diagnostic(dashboardAdvertised, dashboardEffective, dashboard.reachable, dashboard.httpStatus, dashboard.reachable ? "ok" : dashboard.reason, checkedAt);
  const hints: string[] = [];
  const healthDashboard = options.nodeReportedHealth?.dashboard;
  const remoteUpdate = options.remoteUpdate || {};

  if (healthDashboard === true && !dashboard.reachable) pushHint(hints, "dashboard_bind_loopback_only");
  if (dashboard.reason === "connection_refused" && vnc.reachable) pushHint(hints, "dashboard_port_refused_vnc_available");
  if (Boolean(remoteUpdate.required) || Number(remoteUpdate.versionsBehind || 0) > 0) pushHint(hints, "stale_remote_console");
  for (const hint of options.remoteDiagnostics?.hints || []) pushHint(hints, String(hint));
  for (const hint of runtimeHints(options.runtime)) pushHint(hints, hint);
  if (!options.nodeLocal && options.remoteDiagnostics === undefined && options.nodeReportedHealth?.camofox) pushHint(hints, "stale_camofox_image_unverified");

  return {
    checkedAt,
    dashboard,
    vnc,
    web,
    terminal,
    chatHistory,
    hints,
    remote: {
      nodeId: options.nodeId || "",
      nodeBaseUrl: options.nodeBaseUrl || "",
      reportedDashboardHealthy: healthDashboard ?? null,
      consoleReachableDashboard: dashboard.reachable,
    },
    runtime: options.runtime || options.remoteDiagnostics?.runtime || {},
  };
}

export function isRemoteDashboardAuthError(error: any) {
  return /Dashboard API failed:\s*HTTP 401/i.test(String(error?.message || error || ""));
}
