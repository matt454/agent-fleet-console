export function nowIso() {
  return new Date().toISOString();
}

export function toIsoTime(value: unknown) {
  if (!value) return "";
  const text = String(value);
  const numeric = Number(text);
  const date = Number.isFinite(numeric)
    ? new Date(numeric < 10_000_000_000 ? numeric * 1000 : numeric)
    : new Date(text);
  return Number.isNaN(date.getTime()) ? String(value) : date.toISOString();
}
