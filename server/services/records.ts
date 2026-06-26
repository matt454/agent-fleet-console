import { db } from "../database.ts";
import { sanitizeJsonText } from "../lib/sanitize.ts";
import { nowIso } from "../lib/time.ts";

export function parseJson(text: unknown, fallback: any) {
  try {
    return text ? JSON.parse(String(text)) : fallback;
  } catch {
    return fallback;
  }
}

export function rowToJob(row: any) {
  if (!row) return null;
  const payload = parseJson(row.payload_json, {});
  return {
    id: row.id,
    action: row.action,
    instance: row.instance || "",
    status: row.status,
    progress: Number(row.progress || 0),
    payload,
    output: sanitizeJsonText(row.output || ""),
    error: sanitizeJsonText(row.error || ""),
    result: parseJson(row.result_json, {}),
    requestedBy: row.requested_by || "local",
    createdAt: row.created_at,
    startedAt: row.started_at || "",
    completedAt: row.completed_at || "",
  };
}

function rowToEvent(row: any) {
  return {
    id: row.id,
    instance: row.instance || "",
    type: row.type,
    severity: row.severity || "info",
    message: row.message,
    data: parseJson(row.data_json, {}),
    createdAt: row.created_at,
  };
}

export function recordEvent(instance: string, type: string, message: string, data = {}, severity = "info") {
  db.prepare("INSERT INTO events (instance, type, severity, message, data_json, created_at) VALUES (?, ?, ?, ?, ?, ?)")
    .run(instance || "", type, severity, message, JSON.stringify(data), nowIso());
}

export function recentEvents(instance = "", limit = 20) {
  const query = instance
    ? "SELECT * FROM events WHERE instance = ? ORDER BY created_at DESC LIMIT ?"
    : "SELECT * FROM events ORDER BY created_at DESC LIMIT ?";
  const rows = instance ? db.prepare(query).all(instance, limit) : db.prepare(query).all(limit);
  return rows.map(rowToEvent);
}
