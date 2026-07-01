import fsSync from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { BUILD_TIMEOUT_MS, validators } from "../config.ts";
import { db } from "../database.ts";
import { exportBackup, restoreBackup } from "./backups.ts";
import { tempDir } from "./backup-files.ts";
import { discoverInstanceNames, instanceSnapshot, runManager } from "./instances.ts";
import { setFleetInstanceDisplayName, setInstanceDisplayName } from "./instance-meta.ts";
import { isNemoClawInstance, runNemoHermesAction } from "./nemoclaw.ts";

type FleetNodeRecord = {
  id: string;
  label: string;
  base_url: string;
  auth_token: string;
  enabled: number;
};

type MoveOptions = {
  sourceNodeId: string;
  targetNodeId: string;
  includeWorkspace: boolean;
  includeSecrets: boolean;
  startTarget: boolean;
  removeSource: boolean;
};

type MoveProgress = (progress: number) => void;

const LOCAL_NODE = {
  id: "local",
  label: "Local Docker",
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function nodeById(id: string) {
  return db.prepare("SELECT * FROM fleet_nodes WHERE id = ?").get(id) as FleetNodeRecord | undefined;
}

function requireRemoteNode(id: string) {
  const row = nodeById(id);
  if (!row || !row.enabled) throw new Error(`Fleet node not found: ${id}`);
  return row;
}

function nodeLabel(id: string) {
  if (id === "local") return LOCAL_NODE.label;
  return nodeById(id)?.label || id;
}

function authHeaders(node: FleetNodeRecord) {
  return node.auth_token ? { Authorization: `Bearer ${node.auth_token}` } : {};
}

async function remoteJson(node: FleetNodeRecord, route: string, options: RequestInit = {}, timeoutMs = 10000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${node.base_url}${route}`, {
      ...options,
      signal: controller.signal,
      redirect: "manual",
      headers: {
        "Content-Type": "application/json",
        ...authHeaders(node),
        ...(options.headers || {}),
      },
    });
    if (response.status >= 300 && response.status < 400) throw new Error(`Unexpected redirect to ${response.headers.get("location") || "unknown"}`);
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
    return data;
  } finally {
    clearTimeout(timer);
  }
}

async function remoteFetch(node: FleetNodeRecord, route: string, options: RequestInit = {}, timeoutMs = 30000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${node.base_url}${route}`, {
      ...options,
      signal: controller.signal,
      redirect: "manual",
      headers: {
        ...authHeaders(node),
        ...(options.headers || {}),
      },
    });
    if (response.status >= 300 && response.status < 400) throw new Error(`Unexpected redirect to ${response.headers.get("location") || "unknown"}`);
    return response;
  } finally {
    clearTimeout(timer);
  }
}

async function remoteArchiveImport(node: FleetNodeRecord, archivePath: string, file: string) {
  const stream = fsSync.createReadStream(archivePath);
  const uploadOptions = {
    method: "POST",
    headers: {
      "Content-Type": "application/gzip",
      "X-Hermes-Archive-File": file,
    },
    body: stream,
    duplex: "half",
  } as unknown as RequestInit & { duplex: "half" };
  const response = await remoteFetch(node, "/api/backups/import", uploadOptions, BUILD_TIMEOUT_MS);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
  return data;
}

function isActiveJob(job: any) {
  return ["queued", "running"].includes(String(job?.status || ""));
}

async function waitForRemoteJob(node: FleetNodeRecord, job: any, label: string, updateProgress: MoveProgress, start: number, end: number) {
  const jobId = Number(job?.id);
  if (!jobId) throw new Error(`${label} did not return a job id`);
  const deadline = Date.now() + BUILD_TIMEOUT_MS + 10 * 60 * 1000;
  let latest = job;
  while (Date.now() < deadline) {
    const childProgress = Math.max(0, Math.min(100, Number(latest?.progress || 0)));
    updateProgress(Math.min(end, start + Math.round((childProgress / 100) * (end - start))));
    if (!isActiveJob(latest)) break;
    await sleep(2000);
    latest = (await remoteJson(node, `/api/jobs/${encodeURIComponent(String(jobId))}`, {}, 15000)).job;
  }
  if (isActiveJob(latest)) throw new Error(`${label} timed out`);
  if (latest?.status !== "completed") throw new Error(latest?.error || `${label} failed`);
  updateProgress(end);
  return latest;
}

async function readNodeInstance(nodeId: string, name: string) {
  if (nodeId === "local") return instanceSnapshot(name);
  const node = requireRemoteNode(nodeId);
  return (await remoteJson(node, `/api/instances/${encodeURIComponent(name)}`, {}, 15000)).instance;
}

async function targetHasInstance(nodeId: string, name: string) {
  if (nodeId === "local") return (await discoverInstanceNames()).includes(name);
  const node = requireRemoteNode(nodeId);
  const data = await remoteJson(node, "/api/instances", {}, 15000);
  return (data.instances || []).some((instance: any) => instance?.name === name);
}

function assertSnapshotExists(instance: any, name: string, label: string) {
  if (!instance || instance.name !== name || (instance.composeAvailable === false && instance.runtime !== "nemoclaw")) {
    throw new Error(`${label} agent not found: ${name}`);
  }
}

async function exportFromSource(sourceNodeId: string, name: string, options: MoveOptions, updateProgress: MoveProgress) {
  if (sourceNodeId === "local") {
    updateProgress(12);
    const result = await exportBackup({
      scope: "agent",
      names: [name],
      includeSecrets: options.includeSecrets,
      includeWorkspace: options.includeWorkspace,
    });
    updateProgress(30);
    return { archivePath: result.archive.path, file: result.archive.file, cleanupDir: "" };
  }

  const sourceNode = requireRemoteNode(sourceNodeId);
  const data = await remoteJson(sourceNode, "/api/backups/export", {
    method: "POST",
    body: JSON.stringify({
      scope: "agent",
      names: [name],
      includeSecrets: options.includeSecrets,
      includeWorkspace: options.includeWorkspace,
    }),
  }, 15000);
  const exportJob = await waitForRemoteJob(sourceNode, data.job, "Source backup export", updateProgress, 8, 30);
  const file = validators.validateBackupFilename(exportJob.result?.archive?.file || "");
  const response = await remoteFetch(sourceNode, `/api/backups/${encodeURIComponent(file)}/download`, {}, BUILD_TIMEOUT_MS);
  if (!response.ok) throw new Error(`Backup download failed: HTTP ${response.status}`);
  if (!response.body) throw new Error("Backup download returned an empty body");
  const cleanupDir = await tempDir("hermes-move-");
  const archivePath = path.join(cleanupDir, file);
  await pipeline(Readable.fromWeb(response.body as any), fsSync.createWriteStream(archivePath, { mode: 0o600 }));
  updateProgress(42);
  return { archivePath, file, cleanupDir };
}

async function restoreToTarget(targetNodeId: string, archivePath: string, file: string, options: MoveOptions, updateProgress: MoveProgress) {
  if (targetNodeId === "local") {
    updateProgress(54);
    const result = await restoreBackup({
      archivePath,
      namePrefix: "",
      restoreGlobalConfig: false,
      restoreSecrets: options.includeSecrets,
      startRestored: options.startTarget,
    });
    updateProgress(88);
    return result;
  }

  const targetNode = requireRemoteNode(targetNodeId);
  updateProgress(52);
  const imported = await remoteArchiveImport(targetNode, archivePath, file);
  const archivePathOnTarget = imported.archive?.path;
  if (!archivePathOnTarget) throw new Error("Target node did not return an imported archive path");
  updateProgress(60);
  const restore = await remoteJson(targetNode, "/api/backups/restore", {
    method: "POST",
    body: JSON.stringify({
      archivePath: archivePathOnTarget,
      namePrefix: "",
      restoreGlobalConfig: false,
      restoreSecrets: options.includeSecrets,
      startRestored: options.startTarget,
    }),
  }, 15000);
  const restoreJob = await waitForRemoteJob(targetNode, restore.job, "Target restore", updateProgress, 60, 88);
  return restoreJob.result;
}

async function applyDisplayName(targetNodeId: string, name: string, displayName: string) {
  const value = displayName.trim();
  if (!value) return false;
  setFleetInstanceDisplayName(targetNodeId, name, value);
  if (targetNodeId === "local") {
    setInstanceDisplayName(name, value);
    return true;
  }
  const targetNode = requireRemoteNode(targetNodeId);
  await remoteJson(targetNode, `/api/instances/${encodeURIComponent(name)}/display-name`, {
    method: "PUT",
    body: JSON.stringify({ displayName: value }),
  }, 15000);
  return true;
}

async function removeSource(nodeId: string, name: string, updateProgress: MoveProgress) {
  if (nodeId === "local") {
    updateProgress(92);
    const result = await isNemoClawInstance(name)
      ? await runNemoHermesAction(name, "delete", 120000)
      : await runManager(["delete", name], 120000);
    updateProgress(97);
    return { output: [result.stdout, result.stderr].filter(Boolean).join("\n") };
  }
  const sourceNode = requireRemoteNode(nodeId);
  const data = await remoteJson(sourceNode, `/api/instances/${encodeURIComponent(name)}/actions`, {
    method: "POST",
    body: JSON.stringify({ action: "delete", confirmed: true, riskConfirmed: true, confirmedRisk: true, riskAccepted: true }),
  }, 15000);
  const deleteJob = await waitForRemoteJob(sourceNode, data.job, "Source delete", updateProgress, 90, 97);
  return deleteJob.result;
}

function normalizeMovePayload(job: any): MoveOptions {
  const payload = job.payload || {};
  const sourceNodeId = validators.validateFleetNodeId(payload.sourceNodeId || "local");
  const options = validators.normalizeMoveOptions(payload);
  if (sourceNodeId === options.targetNodeId) throw new Error("Choose a different target node");
  return { sourceNodeId, ...options };
}

export async function runFleetMove(job: any, updateProgress: MoveProgress) {
  const name = validators.validateName(job.instance || job.payload?.name || "");
  const options = normalizeMovePayload(job);
  let cleanupDir = "";

  try {
    updateProgress(6);
    const source = await readNodeInstance(options.sourceNodeId, name);
    assertSnapshotExists(source, name, "Source");
    if (source.runtime === "nemoclaw") {
      throw new Error("Moving NemoHermes agents is not supported yet. Back up the agent manually or recreate it on the target node.");
    }
    if (await targetHasInstance(options.targetNodeId, name)) throw new Error(`Target node already has an agent named ${name}`);

    const exported = await exportFromSource(options.sourceNodeId, name, options, updateProgress);
    cleanupDir = exported.cleanupDir;
    const restore = await restoreToTarget(options.targetNodeId, exported.archivePath, exported.file, options, updateProgress);
    const displayNameSynced = await applyDisplayName(options.targetNodeId, name, String(source.displayName || ""));
    const target = await readNodeInstance(options.targetNodeId, name);
    assertSnapshotExists(target, name, "Target");
    updateProgress(90);

    const sourceRemoval = options.removeSource ? await removeSource(options.sourceNodeId, name, updateProgress) : null;
    updateProgress(98);

    const sourceLabel = nodeLabel(options.sourceNodeId);
    const targetLabel = nodeLabel(options.targetNodeId);
    return {
      output: `Moved ${name} from ${sourceLabel} to ${targetLabel}.${options.removeSource ? " Source removed." : " Source retained."}`,
      result: {
        instance: name,
        sourceNodeId: options.sourceNodeId,
        targetNodeId: options.targetNodeId,
        includeWorkspace: options.includeWorkspace,
        includeSecrets: options.includeSecrets,
        startTarget: options.startTarget,
        removedSource: options.removeSource,
        archive: { file: exported.file },
        restore,
        displayNameSynced,
        sourceRemoval,
      },
    };
  } finally {
    if (cleanupDir) await fs.rm(cleanupDir, { recursive: true, force: true });
  }
}
