import { useCallback, useEffect, useMemo, useReducer, useRef } from "react";
import { api, postJson } from "../controllers/api.ts";
import type { ChatRunStatus, ChatSendResponse, Instance, Job, Message, Session } from "../models/fleet.ts";
import { fetchSessionsByAgent } from "./chat-api.ts";
import { chatFailureMessage, completedJobOutputMessage, groupSessions, nextSessionId, sortSessions } from "./chat-utils.ts";
import { activeChatJob, agentKeyFor, chatReducer, delay, INITIAL_CHAT_STATE, isTerminalStatus } from "./chat-state.ts";

export function useChatPanel({ selected, jobs, instances, openAgent }: {
  selected: Instance;
  jobs: Job[];
  instances: Instance[];
  openAgent: (name: string, nodeId?: string) => void;
}) {
  const [state, dispatch] = useReducer(chatReducer, INITIAL_CHAT_STATE);
  const stateRef = useRef(state);
  const agentKey = agentKeyFor(selected);
  const agentKeyRef = useRef(agentKey);
  const messagesRequestRef = useRef(0);
  const sessionsRequestRef = useRef(0);
  const pollInFlightRef = useRef(false);
  const draftNewChatRef = useRef(false);
  const pendingNewChatRef = useRef(false);
  const pendingStartedAtRef = useRef("");
  const sessionsBeforeSendRef = useRef<Set<string>>(new Set());
  const preferredSessionRef = useRef<{ agent: string; sessionId: string } | null>(null);
  const currentSessionIdRef = useRef("");
  const filterInputRef = useRef<HTMLInputElement>(null);
  const settlingRef = useRef("");
  const runPollFailuresRef = useRef(0);
  const jobPollFailuresRef = useRef(0);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const selectedNodeId = selected.nodeId || "local";
  const selectedLabel = selected.displayName?.trim() || selected.name;
  const selectedNodeLabel = selected.nodeLabel || (selectedNodeId === "local" ? "Local Docker" : selectedNodeId);
  const currentJobFromList = useMemo(() => activeChatJob(jobs, selected), [jobs, selected]);
  const pendingJobFromList = useMemo(() => {
    if (!state.pendingJob) return null;
    return jobs.find((job) => job.id === state.pendingJob?.id && (job.nodeId || "local") === state.pendingJob?.nodeId) || null;
  }, [jobs, state.pendingJob]);
  const pendingJob = state.polledJob || pendingJobFromList;
  const turnActive = Boolean(state.sending || state.awaitingResponse || state.pendingRunId || state.pendingJob);
  const agentIsTyping = Boolean(turnActive || currentJobFromList || state.messages.some((message) => message.pending));

  function resetTurnRefs() {
    pendingNewChatRef.current = false;
    pendingStartedAtRef.current = "";
    sessionsBeforeSendRef.current = new Set();
    settlingRef.current = "";
    runPollFailuresRef.current = 0;
    jobPollFailuresRef.current = 0;
  }

  const fetchMessages = useCallback(async (id: string, options: { dropPending?: boolean } = {}) => {
    const key = agentKeyRef.current;
    const requestId = ++messagesRequestRef.current;
    const data = await api<{ messages: Message[] }>(`/api/fleet/${encodeURIComponent(selectedNodeId)}/instances/${encodeURIComponent(selected.name)}/sessions/${encodeURIComponent(id)}/messages`);
    if (agentKeyRef.current !== key || requestId !== messagesRequestRef.current) return [];
    const messages = data.messages || [];
    dispatch({ type: "messages", messages, dropPending: options.dropPending });
    return messages;
  }, [selected.name, selectedNodeId]);

  const loadSessions = useCallback(async (quiet = false) => {
    const key = agentKeyRef.current;
    const requestId = ++sessionsRequestRef.current;
    if (!quiet) dispatch({ type: "patch", patch: { loading: true } });
    try {
      const data = await api<{ sessions: Session[] }>(`/api/fleet/${encodeURIComponent(selectedNodeId)}/instances/${encodeURIComponent(selected.name)}/sessions`);
      if (agentKeyRef.current !== key || requestId !== sessionsRequestRef.current) return;
      const list = data.sessions || [];
      const current = stateRef.current;
      const preferred = preferredSessionRef.current?.agent === key ? preferredSessionRef.current.sessionId : "";
      const sessionId = nextSessionId({
        currentSessionId: current.sessionId,
        draftNewChat: draftNewChatRef.current,
        pendingNewChat: pendingNewChatRef.current,
        pendingStartedAt: pendingStartedAtRef.current,
        preferredSessionId: preferred,
        sessions: list,
        sessionsBeforeSend: sessionsBeforeSendRef.current,
      });
      dispatch({ type: "sessions", agentKey: key, sessions: list, sessionId });
      currentSessionIdRef.current = sessionId;
      if (preferred) preferredSessionRef.current = null;
      if (sessionId) await fetchMessages(sessionId);
      else dispatch({ type: "messages", messages: [], dropPending: false });
      dispatch({ type: "patch", patch: { chatError: "" } });
    } catch (err: any) {
      if (!quiet) dispatch({ type: "patch", patch: { chatError: err.message || "Could not load sessions" } });
    } finally {
      if (agentKeyRef.current === key && requestId === sessionsRequestRef.current) {
        dispatch({ type: "patch", patch: { loading: false } });
      }
    }
  }, [fetchMessages, selected.name, selectedNodeId]);

  async function fetchAllSessions() {
    dispatch({ type: "patch", patch: { sessionsLoading: true } });
    try {
      const entries = await fetchSessionsByAgent(instances);
      dispatch({ type: "allSessions", entries });
    } finally {
      dispatch({ type: "patch", patch: { sessionsLoading: false } });
    }
  }

  const settleJob = useCallback(async (job: Job) => {
    const settleKey = `${job.nodeId || selectedNodeId}:${job.id}`;
    if (settlingRef.current === settleKey) return;
    settlingRef.current = settleKey;
    const failed = ["failed", "canceled", "cancelled"].includes(String(job.status || "").toLowerCase());
    const resultSessionId = typeof job.result?.sessionId === "string" ? job.result.sessionId : "";
    if (resultSessionId) {
      currentSessionIdRef.current = resultSessionId;
      preferredSessionRef.current = { agent: agentKeyRef.current, sessionId: resultSessionId };
      dispatch({ type: "patch", patch: { sessionId: resultSessionId } });
    }
    for (let index = 0; index < 5; index += 1) {
      await loadSessions(true);
      const sessionId = resultSessionId || currentSessionIdRef.current || stateRef.current.sessionId;
      if (sessionId) await fetchMessages(sessionId, { dropPending: index === 4 || failed });
      if (index < 4) await delay(600);
    }
    const fallbackMessage = !failed ? completedJobOutputMessage(job, stateRef.current.messages.some((message) => message.pending)) : null;
    if (fallbackMessage) dispatch({ type: "append", message: fallbackMessage });
    if (failed) dispatch({ type: "patch", patch: { chatError: chatFailureMessage(job) } });
    dispatch({ type: "pendingDone" });
    dispatch({ type: "patch", patch: { awaitingResponse: false, pendingJob: null, polledJob: null, sending: false } });
    resetTurnRefs();
  }, [fetchMessages, loadSessions, selectedNodeId]);

  const settleRun = useCallback(async (run: ChatRunStatus) => {
    const failed = ["failed", "error", "cancelled", "canceled"].includes(run.status.toLowerCase());
    if (run.sessionId) {
      currentSessionIdRef.current = run.sessionId;
      preferredSessionRef.current = { agent: agentKeyRef.current, sessionId: run.sessionId };
      dispatch({ type: "patch", patch: { sessionId: run.sessionId } });
    }
    await loadSessions(true);
    const sessionId = run.sessionId || currentSessionIdRef.current || stateRef.current.sessionId;
    if (sessionId) await fetchMessages(sessionId, { dropPending: true });
    if (!sessionId && run.output && !failed) {
      dispatch({
        type: "append",
        message: { id: `run-${run.runId}`, role: "assistant", content: run.output, createdAt: new Date().toISOString() },
      });
    }
    if (failed) dispatch({ type: "patch", patch: { chatError: run.output || `Run ${run.status}` } });
    dispatch({ type: "pendingDone" });
    dispatch({ type: "patch", patch: { awaitingResponse: false, pendingRunId: "", canStopRun: false, sending: false } });
    resetTurnRefs();
  }, [fetchMessages, loadSessions]);

  async function sendMessage(value: string) {
    const content = value.trim();
    const current = stateRef.current;
    if (!content || current.sending || current.awaitingResponse || current.pendingJob || current.pendingRunId) return;
    const tempId = `pending-${Date.now()}`;
    pendingNewChatRef.current = !current.sessionId;
    draftNewChatRef.current = false;
    pendingStartedAtRef.current = new Date().toISOString();
    sessionsBeforeSendRef.current = new Set(current.sessions.map((session) => session.id));
    dispatch({ type: "append", message: { id: tempId, role: "user", content, createdAt: new Date().toISOString(), pending: true } });
    dispatch({ type: "patch", patch: { text: "", sending: true, awaitingResponse: true, chatError: "", pendingJob: null, polledJob: null, pendingRunId: "", canStopRun: false } });
    try {
      const response = await postJson<ChatSendResponse>(`/api/fleet/${encodeURIComponent(selectedNodeId)}/instances/${encodeURIComponent(selected.name)}/sessions/chat`, {
        sessionId: current.sessionId || undefined,
        message: content,
        executionPolicy: current.bypassApprovals ? "bypass-approvals" : "default",
      });
      if (agentKeyRef.current !== agentKey) return;
      if (response.sessionId) {
        currentSessionIdRef.current = response.sessionId;
        dispatch({ type: "patch", patch: { sessionId: response.sessionId } });
      }
      if (response.mode === "api-run" && response.runId) {
        dispatch({ type: "patch", patch: { sending: false, pendingRunId: response.runId, canStopRun: response.canStop === true } });
      } else if (response.job?.id) {
        dispatch({
          type: "patch",
          patch: { sending: false, pendingJob: { id: response.job.id, nodeId: response.job.nodeId || selectedNodeId }, polledJob: response.job },
        });
      } else if (response.messages?.length) {
        dispatch({ type: "messages", messages: response.messages, dropPending: true });
        dispatch({ type: "pendingDone" });
        dispatch({ type: "patch", patch: { sending: false, awaitingResponse: false } });
        resetTurnRefs();
      } else {
        throw new Error("Chat response did not include a run or job");
      }
    } catch (err: any) {
      if (err.message === "Failed to fetch") {
        await delay(900);
        try {
          const retry = await postJson<ChatSendResponse>(`/api/fleet/${encodeURIComponent(selectedNodeId)}/instances/${encodeURIComponent(selected.name)}/sessions/chat`, {
            sessionId: current.sessionId || undefined,
            message: content,
            executionPolicy: current.bypassApprovals ? "bypass-approvals" : "default",
          });
          if (retry.sessionId) {
            currentSessionIdRef.current = retry.sessionId;
            dispatch({ type: "patch", patch: { sessionId: retry.sessionId } });
          }
          if (retry.job?.id) {
            dispatch({
              type: "patch",
              patch: { sending: false, pendingJob: { id: retry.job.id, nodeId: retry.job.nodeId || selectedNodeId }, polledJob: retry.job },
            });
            return;
          }
          if (retry.mode === "api-run" && retry.runId) {
            dispatch({ type: "patch", patch: { sending: false, pendingRunId: retry.runId, canStopRun: retry.canStop === true } });
            return;
          }
        } catch (retryError: any) {
          err = retryError;
        }
      }
      dispatch({ type: "patch", patch: { chatError: err.message || "Message failed", sending: false, awaitingResponse: false, pendingRunId: "", pendingJob: null, canStopRun: false } });
      dispatch({ type: "pendingDone" });
      resetTurnRefs();
    }
  }

  async function stopTurn() {
    const runId = stateRef.current.pendingRunId;
    if (!runId || !stateRef.current.canStopRun) return;
    try {
      await postJson(`/api/fleet/${encodeURIComponent(selectedNodeId)}/instances/${encodeURIComponent(selected.name)}/sessions/runs/${encodeURIComponent(runId)}/stop`, {});
      dispatch({ type: "patch", patch: { canStopRun: false } });
    } catch (err: any) {
      dispatch({ type: "patch", patch: { chatError: err.message || "Could not stop run", canStopRun: false } });
    }
  }

  function startNewChat() {
    draftNewChatRef.current = true;
    resetTurnRefs();
    dispatch({
      type: "patch",
      patch: { sessionId: "", messages: [], text: "", chatError: "", awaitingResponse: false, pendingJob: null, polledJob: null, pendingRunId: "", canStopRun: false, dropdownOpen: false },
    });
    currentSessionIdRef.current = "";
  }

  async function selectSession(targetAgentKey: string, nextId: string) {
    draftNewChatRef.current = false;
    dispatch({ type: "patch", patch: { dropdownOpen: false } });
    if (targetAgentKey !== agentKey) {
      preferredSessionRef.current = { agent: targetAgentKey, sessionId: nextId };
      const target = instances.find((instance) => agentKeyFor(instance) === targetAgentKey);
      if (target) openAgent(target.name, target.nodeId || "local");
      return;
    }
    currentSessionIdRef.current = nextId;
    dispatch({ type: "patch", patch: { sessionId: nextId, loading: true } });
    try {
      await fetchMessages(nextId, { dropPending: true });
      dispatch({ type: "patch", patch: { chatError: "" } });
    } catch (err: any) {
      dispatch({ type: "patch", patch: { chatError: err.message || "Could not load messages" } });
    } finally {
      dispatch({ type: "patch", patch: { loading: false } });
    }
  }

  function selectAgent(targetAgentKey: string) {
    const target = instances.find((instance) => agentKeyFor(instance) === targetAgentKey);
    if (target) openAgent(target.name, target.nodeId || "local");
    dispatch({ type: "patch", patch: { dropdownOpen: false } });
  }

  useEffect(() => {
    agentKeyRef.current = agentKey;
    messagesRequestRef.current += 1;
    sessionsRequestRef.current += 1;
    draftNewChatRef.current = false;
    resetTurnRefs();
    currentSessionIdRef.current = "";
    dispatch({ type: "reset" });
    loadSessions();
  }, [agentKey, loadSessions]);

  useEffect(() => {
    if (!state.awaitingResponse || state.pendingRunId || !state.sessionId) return;
    const timer = window.setInterval(async () => {
      if (pollInFlightRef.current) return;
      pollInFlightRef.current = true;
      try {
        await fetchMessages(state.sessionId);
      } finally {
        pollInFlightRef.current = false;
      }
    }, 1500);
    return () => window.clearInterval(timer);
  }, [fetchMessages, state.awaitingResponse, state.pendingRunId, state.sessionId]);

  useEffect(() => {
    if (!state.awaitingResponse || state.sessionId || !state.pendingJob) return;
    const timer = window.setInterval(async () => {
      if (pollInFlightRef.current) return;
      pollInFlightRef.current = true;
      try {
        await loadSessions(true);
      } finally {
        pollInFlightRef.current = false;
      }
    }, 1500);
    return () => window.clearInterval(timer);
  }, [loadSessions, state.awaitingResponse, state.pendingJob, state.sessionId]);

  useEffect(() => {
    if (!state.pendingRunId || !state.awaitingResponse) return;
    const timer = window.setInterval(async () => {
      if (pollInFlightRef.current) return;
      pollInFlightRef.current = true;
      try {
        const run = await api<ChatRunStatus>(`/api/fleet/${encodeURIComponent(selectedNodeId)}/instances/${encodeURIComponent(selected.name)}/sessions/runs/${encodeURIComponent(state.pendingRunId)}`);
        runPollFailuresRef.current = 0;
        if (run.sessionId && !stateRef.current.sessionId) {
          currentSessionIdRef.current = run.sessionId;
          dispatch({ type: "patch", patch: { sessionId: run.sessionId } });
        }
        if (isTerminalStatus(run.status)) await settleRun(run);
      } catch (err: any) {
        runPollFailuresRef.current += 1;
        await loadSessions(true).catch(() => undefined);
        if (runPollFailuresRef.current >= 5) {
          dispatch({ type: "patch", patch: { chatError: err.message || "Could not read run status", awaitingResponse: false, pendingRunId: "", canStopRun: false } });
          dispatch({ type: "pendingDone" });
        }
      } finally {
        pollInFlightRef.current = false;
      }
    }, 1200);
    return () => window.clearInterval(timer);
  }, [selected.name, selectedNodeId, settleRun, state.awaitingResponse, state.pendingRunId]);

  useEffect(() => {
    if (!state.pendingJob || !state.awaitingResponse) return;
    const timer = window.setInterval(async () => {
      try {
        const data = await api<{ job: Job }>(`/api/fleet/${encodeURIComponent(state.pendingJob!.nodeId)}/jobs/${encodeURIComponent(String(state.pendingJob!.id))}`);
        if (!data.job) return;
        jobPollFailuresRef.current = 0;
        dispatch({ type: "patch", patch: { polledJob: data.job } });
        if (isTerminalStatus(data.job.status)) await settleJob(data.job);
      } catch (err: any) {
        jobPollFailuresRef.current += 1;
        await loadSessions(true).catch(() => undefined);
        if (jobPollFailuresRef.current >= 5) {
          dispatch({ type: "patch", patch: { chatError: err.message || "Could not read chat job", awaitingResponse: false, pendingJob: null, polledJob: null } });
          dispatch({ type: "pendingDone" });
        }
      }
    }, 1200);
    return () => window.clearInterval(timer);
  }, [settleJob, state.awaitingResponse, state.pendingJob]);

  useEffect(() => {
    if (pendingJob && isTerminalStatus(pendingJob.status)) settleJob(pendingJob);
  }, [pendingJob, settleJob]);

  useEffect(() => {
    if (!state.dropdownOpen) return;
    if (instances.length > 1) fetchAllSessions();
    window.setTimeout(() => filterInputRef.current?.focus(), 0);
  }, [state.dropdownOpen, instances.length]);

  const singleAgent = instances.length <= 1;
  const selectedSession = state.sessions.find((session) => session.id === state.sessionId);
  const sessionsMap = useMemo(() => {
    const map = new Map(state.allSessionsMap);
    map.set(agentKey, { sessions: state.sessions, loaded: true });
    return map;
  }, [agentKey, state.allSessionsMap, state.sessions]);
  const groupedSessions = singleAgent
    ? [{ agent: selected.name, agentKey, nodeId: selectedNodeId, label: selectedLabel, sessions: sortSessions(state.sessions), loaded: true }]
    : groupSessions(sessionsMap, instances);
  const statusLabel = state.sending
    ? "Sending"
    : state.pendingRunId
      ? "Running"
      : state.pendingJob
        ? (pendingJob?.status === "queued" ? "Queued" : "Working")
        : currentJobFromList
          ? "Working"
          : "Ready";

  return {
    activeJobs: jobs.filter((job) => ["queued", "running"].includes(job.status)),
    agentIsTyping,
    busy: state.sending,
    canStop: Boolean(state.pendingRunId && state.canStopRun),
    chatError: state.chatError,
    dropdownFilter: state.dropdownFilter,
    dropdownOpen: state.dropdownOpen,
    filter: state.dropdownFilter.trim().toLowerCase(),
    filterInputRef,
    groupedSessions,
    loadSessions,
    loading: state.loading,
    messages: state.messages,
    nodeLabel: selectedNodeLabel,
    selectedAgentLabel: selectedLabel,
    selectedSessionId: state.sessionId,
    selectedSessionTitle: selectedSession ? selectedSession.title || "Untitled session" : "New chat",
    selectAgent,
    selectSession,
    sessionsLoading: state.sessionsLoading,
    setDropdownFilter: (value: string) => dispatch({ type: "patch", patch: { dropdownFilter: value } }),
    setDropdownOpen: (open: boolean) => dispatch({ type: "patch", patch: { dropdownOpen: open } }),
    setBypassApprovals: (bypassApprovals: boolean) => dispatch({ type: "patch", patch: { bypassApprovals } }),
    setText: (text: string) => dispatch({ type: "patch", patch: { text } }),
    singleAgent,
    startNewChat,
    statusLabel,
    stopTurn,
    bypassApprovals: state.bypassApprovals,
    text: state.text,
    turnActive,
    sendMessage,
  };
}
