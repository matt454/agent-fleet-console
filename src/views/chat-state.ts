import type { Instance, Job, Message, Session } from "../models/fleet.ts";
import type { AgentSessionState } from "./chat-utils.ts";

type PendingJob = { id: number; nodeId: string } | null;

export type ChatState = {
  sessions: Session[];
  sessionId: string;
  messages: Message[];
  text: string;
  loading: boolean;
  sending: boolean;
  awaitingResponse: boolean;
  pendingJob: PendingJob;
  polledJob: Job | null;
  pendingRunId: string;
  canStopRun: boolean;
  chatError: string;
  dropdownOpen: boolean;
  allSessionsMap: Map<string, AgentSessionState>;
  sessionsLoading: boolean;
  dropdownFilter: string;
  bypassApprovals: boolean;
};

type ChatAction =
  | { type: "patch"; patch: Partial<ChatState> }
  | { type: "reset" }
  | { type: "append"; message: Message }
  | { type: "messages"; messages: Message[]; dropPending?: boolean }
  | { type: "pendingDone" }
  | { type: "sessions"; agentKey: string; sessions: Session[]; sessionId: string }
  | { type: "allSessions"; entries: Array<[string, AgentSessionState]> };

export const INITIAL_CHAT_STATE: ChatState = {
  sessions: [],
  sessionId: "",
  messages: [],
  text: "",
  loading: false,
  sending: false,
  awaitingResponse: false,
  pendingJob: null,
  polledJob: null,
  pendingRunId: "",
  canStopRun: false,
  chatError: "",
  dropdownOpen: false,
  allSessionsMap: new Map(),
  sessionsLoading: false,
  dropdownFilter: "",
  bypassApprovals: false,
};

export function delay(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

export function agentKeyFor(instance: Instance) {
  return instance.fleetKey || `${instance.nodeId || "local"}:${instance.name}`;
}

function mergePending(current: Message[], nextMessages: Message[], dropPending = false) {
  if (dropPending) return nextMessages;
  const pending = current.filter((message) => message.pending);
  if (!pending.length) return nextMessages;
  const missing = pending.filter((pendingMessage) => (
    !nextMessages.some((message) => message.role === pendingMessage.role && message.content === pendingMessage.content)
  ));
  return missing.length ? [...nextMessages, ...missing] : nextMessages;
}

export function chatReducer(state: ChatState, action: ChatAction): ChatState {
  switch (action.type) {
    case "patch":
      return { ...state, ...action.patch };
    case "reset":
      return { ...INITIAL_CHAT_STATE, allSessionsMap: state.allSessionsMap };
    case "append":
      return { ...state, messages: [...state.messages, action.message] };
    case "messages":
      return { ...state, messages: mergePending(state.messages, action.messages, action.dropPending) };
    case "pendingDone":
      return { ...state, messages: state.messages.map((message) => message.pending ? { ...message, pending: false } : message) };
    case "sessions": {
      const allSessionsMap = new Map(state.allSessionsMap);
      allSessionsMap.set(action.agentKey, { sessions: action.sessions, loaded: true });
      return { ...state, sessions: action.sessions, sessionId: action.sessionId, allSessionsMap };
    }
    case "allSessions":
      return { ...state, allSessionsMap: new Map(action.entries) };
    default:
      return state;
  }
}

export function isTerminalStatus(status = "") {
  return ["completed", "failed", "cancelled", "canceled", "error"].includes(status.toLowerCase());
}

export function activeChatJob(jobs: Job[], selected: Instance) {
  const nodeId = selected.nodeId || "local";
  return jobs.find((job) => (
    job.instance === selected.name
    && (job.nodeId || "local") === nodeId
    && job.action === "session-chat"
    && ["queued", "running"].includes(job.status)
  ));
}
