const CREDENTIAL_KEY_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/;

export const CREDENTIAL_KEY_HELP = "Use letters, numbers, and underscores. The first character must be a letter or underscore.";

export function credentialKeyError(value: string) {
  const key = value.trim();
  if (!key) return "";
  if (key.length > 120) return "Credential keys must be 120 characters or fewer.";
  if (!CREDENTIAL_KEY_PATTERN.test(key)) return CREDENTIAL_KEY_HELP;
  return "";
}
