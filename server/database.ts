import fs from "node:fs/promises";
import { DatabaseSync } from "node:sqlite";
import { BUILTIN_TEMPLATES } from "./catalog.ts";
import { DATA_DIR, DB_FILE, SECRETS_DIR } from "./config.ts";
import { initializeDatabase } from "./schema.ts";
import { nowIso } from "./lib/time.ts";

await fs.mkdir(DATA_DIR, { recursive: true });
await fs.mkdir(SECRETS_DIR, { recursive: true, mode: 0o700 });

export const db = new DatabaseSync(DB_FILE);
initializeDatabase(db, { builtinTemplates: BUILTIN_TEMPLATES, nowIso });
