import path from "node:path";
import { TELEGRAM_ONBOARDING_URL } from "../config.ts";
import { setEnvValue } from "../lib/env-file.ts";
import { homeDir } from "./compose.ts";
import { runNemoHermesExec } from "./nemoclaw.ts";

type PairingRecord = {
  pollToken: string;
  expiresAt: string;
  expiresAtMs: number;
  botToken?: string;
  botUsername?: string;
  ownerUserId?: string;
};

const pairings = new Map<string, PairingRecord>();

function httpError(status: number, message: string) {
  const error = new Error(message) as Error & { status?: number };
  error.status = status;
  return error;
}

function baseUrl() {
  return TELEGRAM_ONBOARDING_URL.trim().replace(/\/+$/, "");
}

function parseExpiry(value: string) {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : Date.now() + 10 * 60 * 1000;
}

function prunePairings() {
  const now = Date.now();
  for (const [id, record] of pairings) {
    if (record.expiresAtMs <= now) pairings.delete(id);
  }
}

function normalizeUserId(value: unknown) {
  const text = String(value || "").trim();
  return /^[1-9]\d{4,19}$/.test(text) ? text : "";
}

function onboardingErrorMessage(error: string) {
  return {
    not_found: "Telegram pairing was not found. Start a new setup.",
    expired: "Telegram setup expired. Start a new setup.",
    claimed: "Telegram setup was already claimed. Start a new setup.",
    unauthorized: "Telegram setup service rejected this request.",
    telegram_manager_bot_token_not_configured: "Telegram setup service is not configured.",
    telegram_token_fetch_failed: "Telegram could not finish bot setup. Try again.",
  }[error] || "Telegram setup service returned an error.";
}

async function onboardingRequest(method: string, requestPath: string, options: { body?: any; bearerToken?: string } = {}) {
  const response = await fetch(`${baseUrl()}${requestPath}`, {
    method,
    headers: {
      Accept: "application/json",
      "User-Agent": "hermes-fleet-console",
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(options.bearerToken ? { Authorization: `Bearer ${options.bearerToken}` } : {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  }).catch((error) => {
    throw httpError(502, `Telegram setup service is unavailable: ${error.message || "network error"}`);
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const code = String(data.error || data.status || "");
    const status = code === "expired" || code === "claimed" ? 410 : response.status === 404 ? 404 : 502;
    throw httpError(status, onboardingErrorMessage(code));
  }
  if (!data || typeof data !== "object") throw httpError(502, "Telegram setup service returned an invalid response.");
  return data as Record<string, any>;
}

export async function startTelegramOnboarding(input: any = {}) {
  const botName = String(input.botName || input.bot_name || "Hermes Agent").trim() || "Hermes Agent";
  const data = await onboardingRequest("POST", "/v1/telegram/pairings", { body: { bot_name: botName } });
  const pairingId = String(data.pairing_id || "").trim();
  const pollToken = String(data.poll_token || "").trim();
  const expiresAt = String(data.expires_at || "").trim();
  const deepLink = String(data.deep_link || "").trim();
  const suggestedUsername = String(data.suggested_username || "").trim();
  const qrPayload = String(data.qr_payload || deepLink).trim();
  if (!pairingId || !pollToken || !expiresAt || !deepLink || !qrPayload) {
    throw httpError(502, "Telegram setup service returned an incomplete response.");
  }
  prunePairings();
  pairings.set(pairingId, { pollToken, expiresAt, expiresAtMs: parseExpiry(expiresAt) });
  return {
    pairingId,
    pairing_id: pairingId,
    suggestedUsername,
    suggested_username: suggestedUsername,
    deepLink,
    deep_link: deepLink,
    qrPayload,
    qr_payload: qrPayload,
    expiresAt,
    expires_at: expiresAt,
  };
}

export async function telegramOnboardingStatus(pairingId: string) {
  prunePairings();
  const record = pairings.get(pairingId);
  if (!record) throw httpError(404, "Telegram setup session was not found. Start a new setup.");
  if (record.botToken) {
    return {
      status: "ready",
      botToken: record.botToken,
      bot_token: record.botToken,
      botUsername: record.botUsername || "",
      bot_username: record.botUsername || "",
      ownerUserId: record.ownerUserId || "",
      owner_user_id: record.ownerUserId || "",
      expiresAt: record.expiresAt,
      expires_at: record.expiresAt,
    };
  }
  const data = await onboardingRequest("GET", `/v1/telegram/pairings/${encodeURIComponent(pairingId)}`, { bearerToken: record.pollToken });
  const status = String(data.status || "").trim();
  if (status === "waiting") return { status: "waiting", expiresAt: record.expiresAt, expires_at: record.expiresAt };
  if (status === "ready") {
    const botToken = String(data.token || "").trim();
    if (!botToken) throw httpError(502, "Telegram setup service returned an incomplete response.");
    record.botToken = botToken;
    record.botUsername = String(data.bot_username || "").trim() || undefined;
    record.ownerUserId = normalizeUserId(data.owner_user_id) || undefined;
    return {
      status: "ready",
      botToken,
      bot_token: botToken,
      botUsername: record.botUsername || "",
      bot_username: record.botUsername || "",
      ownerUserId: record.ownerUserId || "",
      owner_user_id: record.ownerUserId || "",
      expiresAt: record.expiresAt,
      expires_at: record.expiresAt,
    };
  }
  if (status === "expired" || status === "claimed") {
    pairings.delete(pairingId);
    throw httpError(410, onboardingErrorMessage(status));
  }
  throw httpError(502, "Telegram setup service returned an unknown status.");
}

export function cancelTelegramOnboarding(pairingId: string) {
  pairings.delete(pairingId);
  return { ok: true };
}

function shellQuote(value: string) {
  return `'${String(value).replace(/'/g, "'\\''")}'`;
}

async function setNemoEnvValues(name: string, values: Record<string, string>) {
  const assignments = Object.entries(values)
    .map(([key, value]) => `${key}=${shellQuote(value)}`)
    .join(" ");
  const script = `
set -euo pipefail
python3 - ${assignments} <<'PY'
import json
import os
import pathlib
import sys

path = pathlib.Path("/opt/data/.env")
path.parent.mkdir(parents=True, exist_ok=True)
values = dict(arg.split("=", 1) for arg in sys.argv[1:])
env = {}
if path.exists():
    for line in path.read_text().splitlines():
        if "=" in line and not line.lstrip().startswith("#"):
            key, value = line.split("=", 1)
            env[key.strip()] = value.strip().strip("'\\\"")
env.update(values)
path.write_text("".join(f"{key}={json.dumps(value)}\\n" for key, value in env.items()))
PY
`;
  await runNemoHermesExec(name, script, 30000);
}

export async function applyTelegramSetupToInstance(name: string, telegram: any, runtime = "docker") {
  if (!telegram?.enabled) return { telegram: false };
  const values = {
    TELEGRAM_BOT_TOKEN: telegram.botToken,
    TELEGRAM_ALLOWED_USERS: telegram.allowedUserIds.join(","),
    TELEGRAM_HOME_CHANNEL: telegram.homeChannel || telegram.trustedUserId,
    TELEGRAM_ENABLED: "true",
  };
  const envFile = path.join(homeDir(name), ".env");
  for (const [key, value] of Object.entries(values)) {
    await setEnvValue(envFile, key, value);
  }
  if (runtime === "nemoclaw") {
    await setNemoEnvValues(name, values);
  }
  return {
    telegram: true,
    botUsername: telegram.botUsername || "",
    trustedUserId: telegram.trustedUserId,
    homeChannel: telegram.homeChannel,
    envFile,
  };
}
