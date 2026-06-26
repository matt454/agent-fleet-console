import crypto from "node:crypto";
import { HERMES_CONTAINER_BIN, UPDATE_TIMEOUT_MS } from "../config.ts";
import { parseEnv, readTextIfExists } from "../lib/env-file.ts";
import { run } from "../lib/process.ts";
import { toIsoTime } from "../lib/time.ts";
import { composeExecArgs, homeDir, instanceDir } from "./compose.ts";
import { dashboardPortForInstance } from "./instances.ts";

type HermesApiCandidate = {
  baseUrl: string;
  token: string;
  sessionToken: string;
  source: string;
};

type HermesApiConnection = {
  candidate: HermesApiCandidate;
  capabilities: any;
};

function redact(text: string) {
  return text.replace(/\b[A-Za-z0-9_-]{24,}\b/g, (value) => `${value.slice(0, 4)}...${value.slice(-4)}`);
}

function normalizeSession(row: any) {
  return {
    id: row?.session_id || row?.id || "",
    title: row?.title || row?.name || row?.summary || "",
    source: row?.source || "cli",
    model: row?.model || "",
    messageCount: Number(row?.message_count ?? row?.messages_count ?? row?.messages ?? 0) || 0,
    startedAt: toIsoTime(row?.started_at || row?.created_at),
    lastActive: toIsoTime(row?.last_active || row?.updated_at || row?.started_at),
    endedAt: toIsoTime(row?.ended_at),
    active: Boolean(row?.is_active),
  };
}

function messageRows(data: any) {
  const candidates = [
    data?.messages,
    data?.items,
    data?.events,
    data?.conversation?.messages,
    data?.session?.messages,
  ];
  const rows = candidates.find((value) => Array.isArray(value));
  return rows || [];
}

function messageContent(row: any) {
  const value = row?.content ?? row?.message ?? row?.text ?? row?.output ?? row?.response ?? row?.delta ?? "";
  if (Array.isArray(value)) {
    return value.map((item) => {
      if (typeof item === "string") return item;
      if (typeof item?.text === "string") return item.text;
      if (typeof item?.content === "string") return item.content;
      return JSON.stringify(item ?? "");
    }).filter(Boolean).join("\n");
  }
  return typeof value === "string" ? value : JSON.stringify(value ?? "");
}

function normalizeMessage(row: any) {
  return {
    id: row?.id || crypto.randomUUID(),
    sessionId: row?.session_id || "",
    role: row?.role || row?.source || row?.type || "message",
    source: row?.source || "",
    model: row?.model || "",
    content: redact(messageContent(row)),
    createdAt: toIsoTime(row?.created_at || row?.timestamp || row?.time),
  };
}

function normalizeRun(row: any, runId: string) {
  return {
    mode: "api-run" as const,
    runId: row?.run_id || row?.id || runId,
    status: String(row?.status || "unknown"),
    sessionId: row?.session_id || row?.sessionId || "",
    output: redact(messageContent(row)),
    model: row?.model || "",
    usage: row?.usage || null,
  };
}

async function dashboardInfo(name: string) {
  const port = await dashboardPortForInstance(name);
  if (!port) {
    const error = new Error("Dashboard port not found") as any;
    error.status = 503;
    throw error;
  }
  const baseUrl = `http://127.0.0.1:${port}`;
  const auth = await dashboardAuthCookie(name, baseUrl);
  const headers = auth ? { Cookie: auth } : {};
  const html = await fetch(`${baseUrl}/sessions`, { headers, signal: AbortSignal.timeout(5000) }).then((response) => response.text());
  const token = html.match(/__HERMES_SESSION_TOKEN__="([^"]+)"/)?.[1] || "";
  const embeddedChat = html.match(/__HERMES_DASHBOARD_EMBEDDED_CHAT__=(true|false)/)?.[1] === "true";
  return { port, baseUrl, token, embeddedChat, sessionsUrl: `${baseUrl}/sessions`, chatUrl: `${baseUrl}/chat`, cookie: auth };
}

async function instanceEnv(name: string) {
  return {
    ...parseEnv(await readTextIfExists(`${homeDir(name)}/.env`)),
    ...parseEnv(await readTextIfExists(`${instanceDir(name)}/instance.env`)),
  };
}

async function dashboardAuthCookie(name: string, baseUrl: string) {
  const env = await instanceEnv(name);
  const username = env.HERMES_DASHBOARD_BASIC_AUTH_USERNAME || "";
  const password = env.HERMES_DASHBOARD_BASIC_AUTH_PASSWORD || "";
  if (!username || !password) return "";
  const response = await fetch(`${baseUrl}/auth/password-login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ provider: "basic", username, password, next: "/sessions" }),
    signal: AbortSignal.timeout(5000),
  });
  if (!response.ok) return "";
  const getSetCookie = (response.headers as any).getSetCookie?.bind(response.headers);
  const cookies = typeof getSetCookie === "function" ? getSetCookie() : [response.headers.get("set-cookie") || ""];
  return cookies.map((cookie: string) => cookie.split(";")[0]).filter(Boolean).join("; ");
}

function apiTokenFromEnv(env: Record<string, string>) {
  return env.API_SERVER_KEY || env.HERMES_API_SERVER_KEY || env.HERMES_API_KEY || env.HERMES_GATEWAY_KEY || "";
}

function addCandidate(candidates: HermesApiCandidate[], candidate: HermesApiCandidate) {
  const baseUrl = candidate.baseUrl.replace(/\/+$/, "");
  if (!baseUrl || candidates.some((item) => item.baseUrl === baseUrl)) return;
  candidates.push({ ...candidate, baseUrl });
}

async function apiCandidates(name: string) {
  const env = await instanceEnv(name);
  const token = apiTokenFromEnv(env);
  const candidates: HermesApiCandidate[] = [];
  const urls = [
    env.API_SERVER_URL,
    env.HERMES_API_SERVER_URL,
    env.HERMES_GATEWAY_URL,
  ].filter(Boolean);
  for (const value of urls) {
    addCandidate(candidates, { baseUrl: value, token, sessionToken: "", source: "env-url" });
  }
  const ports = [
    env.API_SERVER_PORT,
    env.HERMES_API_PORT,
    env.HERMES_GATEWAY_PORT,
    env.HEALTH_PORT,
    "8642",
  ].map((value) => Number(value)).filter((value) => Number.isFinite(value) && value > 0);
  for (const port of ports) {
    addCandidate(candidates, { baseUrl: `http://127.0.0.1:${port}`, token, sessionToken: "", source: "env-port" });
  }
  try {
    const info = await dashboardInfo(name);
    addCandidate(candidates, { baseUrl: info.baseUrl, token, sessionToken: info.token, source: "dashboard" });
  } catch {
    // Dashboard access is optional for API probing; fallback chat still works through the CLI.
  }
  return candidates;
}

async function hermesApiJson(candidate: HermesApiCandidate, path: string, options: RequestInit = {}, timeoutMs = 10000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${candidate.baseUrl}${path}`, {
      ...options,
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        ...(candidate.token ? { Authorization: `Bearer ${candidate.token}` } : {}),
        ...(candidate.sessionToken ? { "X-Hermes-Session-Token": candidate.sessionToken } : {}),
        ...(options.headers || {}),
      },
    });
    const text = await response.text();
    const data = text ? JSON.parse(text) : {};
    if (!response.ok) throw new Error(data.error || data.detail || `HTTP ${response.status}`);
    return data;
  } finally {
    clearTimeout(timer);
  }
}

async function hermesApi(name: string): Promise<HermesApiConnection | null> {
  for (const candidate of await apiCandidates(name)) {
    try {
      const capabilities = await hermesApiJson(candidate, "/v1/capabilities", {}, 2500);
      return { candidate, capabilities };
    } catch {
      // Probe all known locations before falling back to the CLI transport.
    }
  }
  return null;
}

function featureEnabled(capabilities: any, key: string) {
  return capabilities?.features?.[key] === true || Boolean(capabilities?.endpoints?.[key]);
}

function extractSessionId(data: any) {
  return data?.session_id || data?.sessionId || data?.id || data?.session?.id || data?.session?.session_id || "";
}

async function createApiSession(api: HermesApiConnection) {
  const data = await hermesApiJson(api.candidate, "/api/sessions", {
    method: "POST",
    body: JSON.stringify({ source: "fleet-console" }),
  }, 10000);
  return extractSessionId(data);
}

async function startApiRun(name: string, payload: any) {
  const api = await hermesApi(name);
  if (!api || !featureEnabled(api.capabilities, "run_submission")) return null;
  let sessionId = String(payload.sessionId || "");
  if (!sessionId && (featureEnabled(api.capabilities, "session_create") || api.capabilities?.endpoints?.session_create)) {
    try {
      sessionId = await createApiSession(api);
    } catch {
      sessionId = "";
    }
  }
  const data = await hermesApiJson(api.candidate, "/v1/runs", {
    method: "POST",
    body: JSON.stringify({
      input: String(payload.message || ""),
      ...(sessionId ? { session_id: sessionId } : {}),
    }),
  }, 15000);
  return {
    mode: "api-run" as const,
    status: data.status || "running",
    runId: data.run_id || data.id || "",
    sessionId: data.session_id || data.sessionId || sessionId,
    canStop: featureEnabled(api.capabilities, "run_stop"),
    transport: api.candidate.source,
  };
}

async function dashboardJson(name: string, apiPath: string) {
  const info = await dashboardInfo(name);
  const headers: Record<string, string> = {};
  if (info.token) headers["X-Hermes-Session-Token"] = info.token;
  if (info.cookie) headers.Cookie = info.cookie;
  const response = await fetch(`${info.baseUrl}${apiPath}`, {
    headers,
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) {
    const error = new Error(`Dashboard API failed: HTTP ${response.status}`) as any;
    error.status = response.status === 404 ? 404 : 502;
    throw error;
  }
  return { info, data: await response.json() };
}

export async function listSessions(name: string, limit = 20, offset = 0) {
  const { info, data } = await dashboardJson(name, `/api/sessions?limit=${limit}&offset=${offset}`);
  return {
    sessions: (data.sessions || []).map(normalizeSession),
    total: Number(data.total || 0),
    limit,
    offset,
    dashboard: info,
  };
}

export async function sessionMessages(name: string, sessionId: string) {
  const { info, data } = await dashboardJson(name, `/api/sessions/${encodeURIComponent(sessionId)}/messages`);
  return {
    sessionId: data.session_id || sessionId,
    messages: messageRows(data).map(normalizeMessage),
    dashboard: info,
  };
}

export async function prepareChatTurn(name: string, payload: any) {
  const executionPolicy = payload.executionPolicy === "bypass-approvals" ? "bypass-approvals" : "default";
  if (executionPolicy === "default") {
    try {
      const apiRun = await startApiRun(name, payload);
      if (apiRun?.runId) return apiRun;
    } catch {
      // API support is opportunistic; old or locally constrained agents use the CLI job path.
    }
  }
  const knownSessionIds = new Set<string>();
  try {
    const before = await listSessions(name, 50, 0);
    for (const session of before.sessions || []) knownSessionIds.add(session.id);
  } catch {
    // Session history may be unavailable before the dashboard is ready.
  }
  return {
    mode: "job" as const,
    status: "queued",
    sessionId: String(payload.sessionId || ""),
    jobPayload: {
      sessionId: String(payload.sessionId || ""),
      message: String(payload.message || ""),
      executionPolicy,
      startedAt: new Date().toISOString(),
      knownSessionIds: [...knownSessionIds],
    },
  };
}

export async function chatRunStatus(name: string, runId: string) {
  const api = await hermesApi(name);
  if (!api) {
    const error = new Error("Hermes API server is unavailable") as any;
    error.status = 503;
    throw error;
  }
  const data = await hermesApiJson(api.candidate, `/v1/runs/${encodeURIComponent(runId)}`, {}, 10000);
  return normalizeRun(data, runId);
}

export async function stopChatRun(name: string, runId: string) {
  const api = await hermesApi(name);
  if (!api || !featureEnabled(api.capabilities, "run_stop")) {
    const error = new Error("This Hermes agent does not support stopping chat runs") as any;
    error.status = 409;
    throw error;
  }
  return hermesApiJson(api.candidate, `/v1/runs/${encodeURIComponent(runId)}/stop`, { method: "POST", body: JSON.stringify({}) }, 10000);
}

export async function resolveChatJobResult(name: string, payload: any) {
  const known = new Set(Array.isArray(payload.knownSessionIds) ? payload.knownSessionIds.map(String) : []);
  const startedAt = new Date(payload.startedAt || 0).getTime();
  const currentSessionId = String(payload.sessionId || "");
  try {
    const after = await listSessions(name, 50, 0);
    const sorted = after.sessions || [];
    const session = currentSessionId
      ? sorted.find((item) => item.id === currentSessionId)
      : sorted.find((item) => !known.has(item.id))
        || sorted.find((item) => new Date(item.lastActive).getTime() >= startedAt - 2000)
        || sorted[0];
    return { sessionId: session?.id || currentSessionId || "", session };
  } catch {
    return { sessionId: currentSessionId || "" };
  }
}

export async function runChatJob(name: string, payload: any, jobId: number) {
  const args = [
    ...composeExecArgs(name, "hermes", [HERMES_CONTAINER_BIN, "chat"]),
  ];
  if (payload.executionPolicy === "bypass-approvals") args.push("--yolo");
  args.push(
    "-q",
    String(payload.message || ""),
    "--quiet",
    "--source",
    "fleet-console",
  );
  if (payload.sessionId) args.push("--resume", String(payload.sessionId));
  return run("docker", args, { jobId, timeout: UPDATE_TIMEOUT_MS, maxBuffer: 1024 * 1024 * 8 });
}
