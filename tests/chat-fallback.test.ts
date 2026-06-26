import test from "node:test";
import assert from "node:assert/strict";
import { isRemoteDashboardAuthError } from "../server/services/gateway-diagnostics.ts";
import { chatAlertTitle, chatErrorDescription, completedJobOutputMessage } from "../src/views/chat-utils.ts";

test("remote dashboard HTTP 401 is treated as history unavailable", () => {
  assert.equal(isRemoteDashboardAuthError(new Error("Dashboard API failed: HTTP 401")), true);
  assert.equal(isRemoteDashboardAuthError(new Error("Dashboard API failed: HTTP 500")), false);
});

test("completed CLI job output renders when session history cannot be loaded", () => {
  const message = completedJobOutputMessage({
    id: 42,
    action: "session-chat",
    instance: "side-project-monkey-1",
    status: "completed",
    progress: 100,
    output: "hello from the CLI job",
  }, true, "2026-06-23T00:00:00.000Z");

  assert.deepEqual(message, {
    id: "job-42",
    role: "assistant",
    content: "hello from the CLI job",
    createdAt: "2026-06-23T00:00:00.000Z",
  });
  assert.equal(completedJobOutputMessage({ id: 43, action: "session-chat", instance: "a", status: "completed", progress: 100, output: "hidden" }, false), null);
});

test("running agents get a truthful chat transport warning", () => {
  const instance = { state: "running", runningServices: 3 };

  assert.equal(chatAlertTitle("Failed to fetch", instance), "Agent is running");
  assert.match(chatErrorDescription("Failed to fetch", "side-project-monkey-1", instance), /is running, but chat is not reachable/);
  assert.equal(chatAlertTitle("Failed to fetch", { state: "stopped", runningServices: 0 }), "Chat connection interrupted");
});
