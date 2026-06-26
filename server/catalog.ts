export const DEFAULT_PROVIDER_CONFIG = {
  provider: "openai-codex",
  model: "gpt-5.5",
  baseUrl: "https://chatgpt.com/backend-api/codex",
  customEndpoints: [],
};
export const GLOBAL_PROVIDER_IDS = ["openai-codex", "ollama", "custom", "openrouter"];
export const CODEX_OAUTH_CLIENT_ID = "app_EMoamEEZ73f0CkXaXp7hrann";
export const CODEX_AUTH_ISSUER = "https://auth.openai.com";
export const CODEX_DEVICE_VERIFICATION_URL = `${CODEX_AUTH_ISSUER}/codex/device`;
export const CODEX_DEVICE_USER_CODE_URL = "https://auth.openai.com/api/accounts/deviceauth/usercode";
export const CODEX_DEVICE_TOKEN_URL = "https://auth.openai.com/api/accounts/deviceauth/token";
export const CODEX_OAUTH_TOKEN_URL = `${CODEX_AUTH_ISSUER}/oauth/token`;
export const CODEX_BASE_URL = "https://chatgpt.com/backend-api/codex";
export const CREDENTIAL_KEY_DENYLIST = new Set([
  "LD_PRELOAD", "LD_LIBRARY_PATH", "LD_AUDIT", "LD_DEBUG",
  "DYLD_INSERT_LIBRARIES", "DYLD_LIBRARY_PATH", "DYLD_FRAMEWORK_PATH",
  "DYLD_FALLBACK_LIBRARY_PATH", "DYLD_FALLBACK_FRAMEWORK_PATH",
  "PYTHONPATH", "PYTHONHOME", "PYTHONSTARTUP", "PYTHONUSERBASE",
  "PYTHONEXECUTABLE", "PYTHONNOUSERSITE",
  "NODE_OPTIONS", "NODE_PATH",
  "PATH", "SHELL", "BROWSER", "EDITOR", "VISUAL", "PAGER",
  "GIT_SSH_COMMAND", "GIT_EXEC_PATH", "GIT_SHELL",
  "HERMES_HOME", "HERMES_PROFILE", "HERMES_CONFIG", "HERMES_ENV",
]);
export const CREDENTIAL_SUFFIXES = ["_API_KEY", "_TOKEN", "_SECRET", "_KEY"];
export const HERMES_PROVIDER_CATALOG_FALLBACK = [
  {
    id: "openai-codex",
    label: "OpenAI Codex",
    description: "OpenAI Codex with ChatGPT device-code login",
    authType: "oauth_device_code",
    credentialKeys: [],
    baseUrlEnvKey: "",
    baseUrl: "https://chatgpt.com/backend-api/codex",
    models: ["gpt-5.5", "gpt-5.5-pro", "gpt-5.4-mini", "gpt-5.3-codex"],
  },
  {
    id: "ollama",
    label: "Ollama",
    description: "Local Ollama through its OpenAI-compatible API",
    authType: "api_key_optional",
    credentialKeys: [],
    baseUrlEnvKey: "OPENAI_BASE_URL",
    baseUrl: "http://127.0.0.1:11434/v1",
    models: ["qwen3-coder:30b", "gpt-oss:20b", "llama3.3:70b", "mistral-small3.2:24b"],
  },
  {
    id: "custom",
    label: "Custom endpoint",
    description: "Custom OpenAI-compatible or Anthropic-compatible endpoint",
    authType: "api_key",
    credentialKeys: ["OPENAI_API_KEY"],
    baseUrlEnvKey: "OPENAI_BASE_URL",
    baseUrl: "",
    models: [],
  },
  {
    id: "openrouter",
    label: "OpenRouter",
    description: "OpenRouter (100+ models, pay-per-use)",
    authType: "api_key",
    credentialKeys: ["OPENROUTER_API_KEY"],
    baseUrlEnvKey: "OPENROUTER_BASE_URL",
    baseUrl: "https://openrouter.ai/api/v1",
    models: [
      "anthropic/claude-opus-4.7",
      "anthropic/claude-sonnet-4.6",
      "moonshotai/kimi-k2.6",
      "openai/gpt-5.5",
      "openai/gpt-5.3-codex",
      "google/gemini-3-flash-preview",
    ],
  },
];
export const INSTANCE_JOB_ACTIONS = ["create", "start", "stop", "restart", "update", "delete"];

export const BUILTIN_TEMPLATES = [
  {
    id: "personal-assistant",
    name: "Personal assistant",
    category: "assistant",
    description: "Daily planning, personal context, research, writing, and follow-through.",
    soul: "You are Matthew's personal Hermes assistant. Be practical, warm, concise, and proactive. Help with daily planning, research, writing, systems, and follow-through while keeping personal context separate from other Hermes instances.",
  },
  {
    id: "research",
    name: "Research",
    category: "research",
    description: "Investigates topics, keeps notes, tracks sources, and summarizes findings.",
    soul: "You are a research-focused Hermes assistant. Investigate carefully, keep sources organized, distinguish facts from assumptions, and produce concise synthesis with next actions.",
  },
  {
    id: "sales-crm",
    name: "Sales/CRM",
    category: "sales",
    description: "CRM hygiene, lead tracking, outreach preparation, and account follow-up.",
    soul: "You are a sales and CRM Hermes assistant. Keep account work organized, preserve context, help prepare outreach, and track follow-ups with crisp operational discipline.",
  },
  {
    id: "telegram-bot",
    name: "Telegram bot",
    category: "integrations",
    description: "Telegram-first assistant with messaging and notification workflows.",
    soul: "You are a Telegram-first Hermes assistant. Be responsive, concise, and reliable. Prioritize clear status updates, safe automation, and explicit confirmation for risky actions.",
  },
  {
    id: "linkedin-automation",
    name: "LinkedIn automation",
    category: "browser",
    description: "Browser-backed LinkedIn workflows with persistence and quota awareness.",
    soul: "You are a LinkedIn automation Hermes assistant. Respect quotas, preserve browser persistence, avoid spammy behavior, and report every meaningful action with evidence.",
  },
  {
    id: "blank",
    name: "Blank Hermes",
    category: "general",
    description: "A clean Hermes instance with the standard Docker browser and memory defaults.",
    soul: "You are a Hermes assistant. Be useful, accurate, concise, and proactive.",
  },
];
