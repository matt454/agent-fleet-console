export function sanitizeJsonText(value: unknown) {
  if (value === undefined || value === null) return "";
  return String(value)
    .replace(/\x1b\][^\x07]*(?:\x07|\x1b\\)/g, "")
    .replace(/\x1b\[[0-?]*[ -/]*[@-~]/g, "")
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "")
    .replace(/\bsk-[A-Za-z0-9_-]{20,}\b/g, "[redacted-openai-key]")
    .replace(/\bgh[pousr]_[A-Za-z0-9_]{30,}\b/g, "[redacted-github-token]")
    .replace(/\b\d{7,12}:[A-Za-z0-9_-]{24,}\b/g, "[redacted-telegram-token]")
    .replace(/\b(Bearer\s+)[A-Za-z0-9._~+/=-]{30,}/gi, "$1[redacted-token]")
    .replace(/\b([A-Z0-9_]*(?:API_KEY|ACCESS_KEY|TOKEN|SECRET|PASSWORD)[A-Z0-9_]*=)([^\s]+)/gi, "$1[redacted]");
}
