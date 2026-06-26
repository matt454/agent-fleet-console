import { existsSync, readFileSync } from "node:fs";

function stripInlineComment(value) {
  let quote = "";
  for (let index = 0; index < value.length; index += 1) {
    const char = value[index];
    const previous = value[index - 1];
    if ((char === "\"" || char === "'") && previous !== "\\") {
      quote = quote === char ? "" : quote || char;
      continue;
    }
    if (char === "#" && !quote && /\s/.test(previous || " ")) {
      return value.slice(0, index).trimEnd();
    }
  }
  return value.trimEnd();
}

function unquoteEnvValue(value) {
  const text = stripInlineComment(String(value || "").trim());
  if (text.length >= 2 && text.startsWith("\"") && text.endsWith("\"")) {
    return text.slice(1, -1).replace(/\\n/g, "\n").replace(/\\"/g, "\"").replace(/\\\\/g, "\\");
  }
  if (text.length >= 2 && text.startsWith("'") && text.endsWith("'")) {
    return text.slice(1, -1);
  }
  return text;
}

export function loadEnvFiles(files = []) {
  for (const file of files.filter(Boolean)) {
    if (!existsSync(file)) continue;
    const text = readFileSync(file, "utf8");
    for (const rawLine of text.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line || line.startsWith("#") || !line.includes("=")) continue;
      const [rawKey, ...rest] = line.split("=");
      const key = rawKey.trim();
      if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) continue;
      if (process.env[key] !== undefined) continue;
      process.env[key] = unquoteEnvValue(rest.join("="));
    }
  }
}

export function envString(name, fallback = "") {
  const value = process.env[name];
  return value === undefined || value === "" ? fallback : value;
}

export function envNumber(name, fallback) {
  const value = process.env[name];
  if (value === undefined || value === "") return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function envFlag(name, fallback = false) {
  const value = process.env[name];
  if (value === undefined || value === "") return fallback;
  return ["1", "true", "yes", "on"].includes(String(value).trim().toLowerCase());
}
