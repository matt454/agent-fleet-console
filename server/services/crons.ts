import fs from "node:fs/promises";
import path from "node:path";
import { homeDir } from "./compose.ts";

const MAX_CRON_FILES = 200;
const MAX_CRON_BYTES = 256 * 1024;

type CronEntry = {
  path: string;
  size: number;
  modifiedAt: string;
  content: string;
  truncated: boolean;
};

export async function readCronEntries(name: string) {
  const root = path.join(homeDir(name), "cron");
  const entries: CronEntry[] = [];

  async function visit(dir: string, prefix = "") {
    if (entries.length >= MAX_CRON_FILES) return;
    let rows: any[] = [];
    try {
      rows = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const row of rows.sort((a, b) => a.name.localeCompare(b.name))) {
      if (entries.length >= MAX_CRON_FILES) return;
      const fullPath = path.join(dir, row.name);
      const relativePath = path.join(prefix, row.name);
      if (row.isDirectory()) {
        await visit(fullPath, relativePath);
        continue;
      }
      if (!row.isFile()) continue;
      try {
        const stat = await fs.stat(fullPath);
        const buffer = await fs.readFile(fullPath);
        const truncated = buffer.byteLength > MAX_CRON_BYTES;
        entries.push({
          path: relativePath.split(path.sep).join("/"),
          size: stat.size,
          modifiedAt: stat.mtime.toISOString(),
          content: buffer.subarray(0, MAX_CRON_BYTES).toString("utf8"),
          truncated,
        });
      } catch {
        // Ignore files that disappear or become unreadable during inventory.
      }
    }
  }

  await visit(root);
  return { root, entries, truncated: entries.length >= MAX_CRON_FILES };
}
