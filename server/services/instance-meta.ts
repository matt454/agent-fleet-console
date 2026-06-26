import { db } from "../database.ts";
import { nowIso } from "../lib/time.ts";

function normalizeDisplayName(value: unknown) {
  const displayName = String(value ?? "").trim().replace(/\s+/g, " ");
  if (/[\0\r\n]/.test(displayName) || displayName.length > 80) {
    const error = new Error("Display name must be a single line under 80 characters") as Error & { status?: number };
    error.status = 400;
    throw error;
  }
  return displayName;
}

export function instanceDisplayName(instance: string) {
  const row = db.prepare("SELECT display_name FROM instance_meta WHERE instance = ?").get(instance) as { display_name?: string } | undefined;
  return row?.display_name || "";
}

export function fleetInstanceDisplayName(nodeId: string, instance: string) {
  const row = db.prepare("SELECT display_name FROM fleet_instance_meta WHERE node_id = ? AND instance = ?").get(nodeId, instance) as { display_name?: string } | undefined;
  return row?.display_name || "";
}

export function setFleetInstanceDisplayName(nodeId: string, instance: string, value: unknown) {
  const displayName = normalizeDisplayName(value);
  const now = nowIso();
  db.prepare(`
    INSERT INTO fleet_instance_meta (node_id, instance, display_name, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(node_id, instance) DO UPDATE SET display_name = excluded.display_name, updated_at = excluded.updated_at
  `).run(nodeId, instance, displayName, now, now);
  return displayName;
}

export function setInstanceDisplayName(instance: string, value: unknown) {
  const displayName = normalizeDisplayName(value);
  const now = nowIso();
  db.prepare(`
    INSERT INTO instance_meta (instance, display_name, created_at, updated_at)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(instance) DO UPDATE SET display_name = excluded.display_name, updated_at = excluded.updated_at
  `).run(instance, displayName, now, now);
  setFleetInstanceDisplayName("local", instance, displayName);
  return displayName;
}
