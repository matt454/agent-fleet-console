import path from "node:path";
import { fileURLToPath } from "node:url";
import { envFlag, envNumber, envString, loadEnvFiles } from "./env.ts";
import {
  CREDENTIAL_KEY_DENYLIST,
  CREDENTIAL_SUFFIXES,
  GLOBAL_PROVIDER_IDS,
  INSTANCE_JOB_ACTIONS,
} from "./catalog.ts";
import { createValidators } from "./validation.ts";

const SERVER_DIR = path.dirname(fileURLToPath(import.meta.url));
export const APP_ROOT = path.resolve(SERVER_DIR, "..");
const DEFAULT_ROOT = path.join(APP_ROOT, "runtime");
const DEFAULT_HERMES_AGENT_SRC = path.join(APP_ROOT, "vendor", "hermes-agent");

function resolveAppPath(value: string) {
  if (value === "~") return process.env.HOME || APP_ROOT;
  if (value.startsWith("~/")) return path.join(process.env.HOME || APP_ROOT, value.slice(2));
  if (path.isAbsolute(value)) return value;
  return path.join(APP_ROOT, value);
}

function resolveExecutable(value: string) {
  return value.includes("/") ? resolveAppPath(value) : value;
}

loadEnvFiles([
  path.join(DEFAULT_ROOT, ".env"),
  path.join(APP_ROOT, ".env"),
  process.env.HERMES_CONSOLE_ENV_FILE || "",
]);

export const ROOT = resolveAppPath(envString("HERMES_INSTANCES_ROOT", DEFAULT_ROOT));
if (ROOT !== DEFAULT_ROOT) {
  loadEnvFiles([path.join(ROOT, ".env")]);
}

export const DATA_DIR = resolveAppPath(envString("HERMES_CONSOLE_DATA_DIR", path.join(APP_ROOT, "data")));
export const DB_FILE = resolveAppPath(envString("HERMES_CONSOLE_DB", path.join(DATA_DIR, "fleet.db")));
export const SECRETS_DIR = resolveAppPath(envString("HERMES_CONSOLE_SECRETS_DIR", path.join(APP_ROOT, "secrets")));
export const GLOBAL_CREDENTIALS_FILE = resolveAppPath(envString("HERMES_GLOBAL_CREDENTIALS_FILE", path.join(SECRETS_DIR, "global-credentials.env")));
export const GLOBAL_PROVIDER_FILE = resolveAppPath(envString("HERMES_GLOBAL_PROVIDER_FILE", path.join(SECRETS_DIR, "global-provider.json")));
export const GLOBAL_OAUTH_DIR = resolveAppPath(envString("HERMES_GLOBAL_OAUTH_DIR", path.join(SECRETS_DIR, "global-oauth")));
export const GLOBAL_SYNC_FILE = resolveAppPath(envString("HERMES_GLOBAL_SYNC_FILE", path.join(SECRETS_DIR, "global-sync.json")));
export const HERMES_DOCKER = resolveAppPath(envString("HERMES_DOCKER_BIN", path.join(APP_ROOT, "bin", "hermes-docker")));
export const NEMOHERMES_BIN = resolveExecutable(envString("NEMOHERMES_BIN", "nemohermes"));
export const HERMES_CONTAINER_BIN = envString("HERMES_CONTAINER_BIN", "/opt/hermes/.venv/bin/hermes");
export const HERMES_AGENT_SRC = resolveAppPath(envString("HERMES_AGENT_SRC", DEFAULT_HERMES_AGENT_SRC));
export const TELEGRAM_ONBOARDING_URL = envString("TELEGRAM_ONBOARDING_URL", "https://setup.hermes-agent.nousresearch.com");
export const NEMOHERMES_AUTO_INSTALL = envFlag("NEMOHERMES_AUTO_INSTALL", true);
export const NEMOHERMES_INSTALL_COMMAND = envString("NEMOHERMES_INSTALL_COMMAND", "curl -fsSL https://www.nvidia.com/nemoclaw.sh | bash");
export const NEMOHERMES_INSTALL_TIMEOUT_MS = envNumber("NEMOHERMES_INSTALL_TIMEOUT_MS", 5 * 60 * 1000);
export const HOST = envString("HERMES_CONSOLE_HOST", "0.0.0.0");
export const PORT = envNumber("HERMES_CONSOLE_PORT", envNumber("HERMES_CONSOLE_API_PORT", 5180));
export const AUTH_TOKEN = envString("HERMES_CONSOLE_TOKEN", "");
export const REQUIRE_AUTH = envFlag("HERMES_CONSOLE_REQUIRE_AUTH", false);
export const RESTART_COMMAND = envString("HERMES_CONSOLE_RESTART_COMMAND", "");
export const ALLOW_SELF_UPDATE = envFlag("HERMES_CONSOLE_ALLOW_SELF_UPDATE", false);
export const UPDATE_TIMEOUT_MS = envNumber("HERMES_CONSOLE_UPDATE_TIMEOUT_MS", 600000);
export const BUILD_TIMEOUT_MS = envNumber("HERMES_CONSOLE_BUILD_TIMEOUT_MS", 30 * 60 * 1000);
export const TERMINAL_TICKET_TTL_MS = envNumber("HERMES_CONSOLE_GATEWAY_TICKET_TTL_MS", 10 * 60 * 1000);
const MAX_CHAT_MESSAGE_CHARS = envNumber("HERMES_CONSOLE_MAX_CHAT_MESSAGE_CHARS", 100000);
const MAX_CONTEXT_FILE_CHARS = envNumber("HERMES_CONSOLE_MAX_CONTEXT_FILE_CHARS", 20000);
const NORMALIZE_LOCAL_MODEL_HOSTS = envFlag("HERMES_NORMALIZE_LOCAL_MODEL_HOSTS", true);

function isLoopbackHost(host = HOST) {
  const normalized = host.trim().toLowerCase().replace(/^\[|\]$/g, "");
  return normalized === "" || normalized === "localhost" || normalized === "::1" || normalized.startsWith("127.");
}

export function validateExposureConfig() {
  if (REQUIRE_AUTH && !AUTH_TOKEN) {
    throw new Error("HERMES_CONSOLE_REQUIRE_AUTH=1 requires HERMES_CONSOLE_TOKEN to be set.");
  }
  if (!isLoopbackHost(HOST) && !AUTH_TOKEN) {
    throw new Error("HERMES_CONSOLE_TOKEN is required when HERMES_CONSOLE_HOST is not loopback.");
  }
}

export const validators = createValidators({
  credentialKeyDenylist: CREDENTIAL_KEY_DENYLIST,
  credentialSuffixes: CREDENTIAL_SUFFIXES,
  instanceJobActions: INSTANCE_JOB_ACTIONS,
  maxChatMessageChars: MAX_CHAT_MESSAGE_CHARS,
  maxContextFileChars: MAX_CONTEXT_FILE_CHARS,
  normalizeLocalModelHosts: NORMALIZE_LOCAL_MODEL_HOSTS,
  providerIds: GLOBAL_PROVIDER_IDS,
});
