import type { Instance, Job, Message, Session } from "../models/fleet.ts";

export type AgentSessionState = { sessions: Session[]; error?: string; loaded?: boolean };
export type AgentSessions = { agent: string; agentKey: string; nodeId: string; label: string; sessions: Session[]; error?: string; loaded?: boolean };

export function messagePreview(value = "", limit = 28) {
  const compact = value.replace(/\s+/g, " ").trim();
  return compact.length > limit ? `${compact.slice(0, limit - 3)}...` : compact;
}

export function messageCountLabel(count: number) {
  return `${count} ${count === 1 ? "message" : "messages"}`;
}

export function chatFailureMessage(job?: Job) {
  const detail = String(job?.error || "").split("\n").find((line) => line.trim())?.trim();
  return detail ? `Message failed: ${messagePreview(detail, 96)}` : "Message failed";
}

function agentLooksRunning(instance?: Pick<Instance, "state" | "runningServices">) {
  return Boolean(instance && (["running", "partial"].includes(instance.state) || Number(instance.runningServices || 0) > 0));
}

function looksLikeChatTransportError(value: string) {
  return /fetch failed|failed to fetch|dashboard api failed|http 401|connection|refused|timeout|unavailable|could not load/i.test(value);
}

export function chatAlertTitle(value: string, instance?: Pick<Instance, "state" | "runningServices">) {
  if (agentLooksRunning(instance) && looksLikeChatTransportError(value)) return "Agent is running";
  return "Chat connection interrupted";
}

export function chatErrorDescription(value: string, agentName: string, instance?: Pick<Instance, "state" | "runningServices">) {
  const detail = value.trim();
  if (!detail) return agentLooksRunning(instance)
    ? `${agentName} is running, but chat history is not reachable from this console right now.`
    : `The console could not load the chat for ${agentName}.`;
  if (agentLooksRunning(instance) && looksLikeChatTransportError(detail)) {
    return `${agentName} is running, but chat is not reachable from this console right now. VNC, Web, and Terminal may still be available.`;
  }
  if (detail.toLowerCase() === "fetch failed") {
    return `The console could not reach ${agentName}. Check that the agent is online, then try again.`;
  }
  return messagePreview(detail, 128);
}

export function sortSessions(sessions: Session[]) {
  return [...sessions].sort((a, b) => new Date(b.lastActive).getTime() - new Date(a.lastActive).getTime());
}

export function groupSessions(allSessions: Map<string, AgentSessionState>, instances: Instance[]): AgentSessions[] {
  return instances.map((instance) => {
    const nodeId = instance.nodeId || "local";
    const agentKey = instance.fleetKey || `${nodeId}:${instance.name}`;
    const host = instance.nodeLabel || (nodeId === "local" ? "Local Docker" : nodeId);
    const state = allSessions.get(agentKey);
    return {
      agent: instance.name,
      agentKey,
      nodeId,
      label: `${instance.name} · ${host}`,
      sessions: sortSessions(state?.sessions || []),
      error: state?.error || "",
      loaded: state?.loaded === true,
    };
  }).sort((a, b) => a.label.localeCompare(b.label));
}

export function nextSessionId({
  currentSessionId,
  draftNewChat,
  pendingNewChat,
  pendingStartedAt,
  preferredSessionId,
  sessions,
  sessionsBeforeSend,
}: {
  currentSessionId: string;
  draftNewChat: boolean;
  pendingNewChat: boolean;
  pendingStartedAt: string;
  preferredSessionId: string;
  sessions: Session[];
  sessionsBeforeSend: Set<string>;
}) {
  const sorted = sortSessions(sessions);
  const newChatSession = pendingNewChat
    ? sorted.find((session) => !sessionsBeforeSend.has(session.id))
      || sorted.find((session) => new Date(session.lastActive).getTime() >= new Date(pendingStartedAt).getTime() - 2000)
    : null;
  if (draftNewChat && !pendingNewChat) return "";
  if (preferredSessionId && sessions.some((session) => session.id === preferredSessionId)) return preferredSessionId;
  if (currentSessionId && sessions.some((session) => session.id === currentSessionId)) return currentSessionId;
  return newChatSession?.id || sessions.find((session) => session.active)?.id || sessions[0]?.id || "";
}

export function isJobActive(agentName: string, activeJobs: Job[], nodeId = "local") {
  return activeJobs.some((job) => job.instance === agentName && (job.nodeId || "local") === nodeId && job.action === "session-chat");
}

export function completedJobOutputMessage(job: Job, hasPendingMessage: boolean, createdAt = new Date().toISOString()): Message | null {
  const output = String(job.output || "").trim();
  if (String(job.status || "").toLowerCase() !== "completed" || !output || !hasPendingMessage) return null;
  return { id: `job-${job.id}`, role: "assistant", content: output, createdAt };
}
