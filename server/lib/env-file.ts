import fs from "node:fs/promises";
import path from "node:path";

export function parseEnv(text = "") {
  const result: Record<string, string> = {};
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const index = trimmed.indexOf("=");
    if (index <= 0) continue;
    const key = trimmed.slice(0, index).trim();
    const value = trimmed.slice(index + 1).trim().replace(/^['"]|['"]$/g, "");
    result[key] = value;
  }
  return result;
}

export async function readTextIfExists(file: string) {
  try {
    return await fs.readFile(file, "utf8");
  } catch {
    return "";
  }
}

export async function fileExists(file: string) {
  try {
    await fs.access(file);
    return true;
  } catch {
    return false;
  }
}

export async function writePrivateFile(file: string, text: string) {
  await fs.mkdir(path.dirname(file), { recursive: true, mode: 0o700 });
  const temporary = `${file}.${process.pid}.tmp`;
  await fs.writeFile(temporary, text, { mode: 0o600 });
  await fs.rename(temporary, file);
}

export async function setEnvValue(file: string, key: string, value: string) {
  const env = parseEnv(await readTextIfExists(file));
  env[key] = value;
  await writePrivateFile(file, Object.entries(env).map(([k, v]) => `${k}=${JSON.stringify(v)}`).join("\n") + "\n");
}

export async function deleteEnvValue(file: string, key: string) {
  const env = parseEnv(await readTextIfExists(file));
  delete env[key];
  await writePrivateFile(file, Object.entries(env).map(([k, v]) => `${k}=${JSON.stringify(v)}`).join("\n") + "\n");
}
