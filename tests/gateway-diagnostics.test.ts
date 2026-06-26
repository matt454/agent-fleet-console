import test from "node:test";
import assert from "node:assert/strict";
import { dashboardAuthFromEnv } from "../server/services/gateway.ts";
import { diagnoseGatewayEndpoints, normalizeRemoteGatewayEndpoints, probeGatewaySurface } from "../server/services/gateway-diagnostics.ts";
import { preferredGatewayUrl } from "../src/controllers/gateway-diagnostics.ts";

test("loopback URLs are rewritten for remote agents", () => {
  const endpoints = normalizeRemoteGatewayEndpoints({
    dashboard: "http://127.0.0.1:9119",
    vnc: "http://localhost:6080/vnc.html",
    web: "http://0.0.0.0:4173",
  }, { base_url: "http://192.168.3.232:5180" });

  assert.equal(endpoints.lanDashboard, "http://192.168.3.232:9119/");
  assert.equal(endpoints.lanVnc, "http://192.168.3.232:6080/vnc.html");
  assert.equal(endpoints.lanWeb, "http://192.168.3.232:4173/");
});

test("refused dashboard URLs report connection_refused", async () => {
  const diagnostic = await probeGatewaySurface({
    advertisedUrl: "http://127.0.0.1:9119",
    effectiveUrl: "http://192.168.3.232:9119",
    path: "/api/status",
    fetchImpl: async () => {
      const error = new Error("connect ECONNREFUSED 192.168.3.232:9119") as Error & { cause?: { code: string } };
      error.cause = { code: "ECONNREFUSED" };
      throw error;
    },
  });

  assert.equal(diagnostic.reachable, false);
  assert.equal(diagnostic.reason, "connection_refused");
});

test("VNC and web remain usable when dashboard is unavailable", async () => {
  const seen: string[] = [];
  const diagnostics = await diagnoseGatewayEndpoints({
    dashboard: "http://127.0.0.1:9119",
    lanDashboard: "http://192.168.3.232:9119",
    vnc: "http://127.0.0.1:6080/vnc.html",
    lanVnc: "http://192.168.3.232:6080/vnc.html",
    web: "http://127.0.0.1:4173",
    lanWeb: "http://192.168.3.232:4173",
  }, {
    fetchImpl: async (input) => {
      const url = String(input);
      seen.push(url);
      if (url.includes(":9119")) {
        const error = new Error("connect ECONNREFUSED") as Error & { cause?: { code: string } };
        error.cause = { code: "ECONNREFUSED" };
        throw error;
      }
      return { ok: true, status: 200 };
    },
  });

  assert.equal(diagnostics.dashboard.reachable, false);
  assert.equal(diagnostics.dashboard.reason, "connection_refused");
  assert.equal(diagnostics.vnc.reachable, true);
  assert.equal(diagnostics.web.reachable, true);
  assert.ok(seen.some((url) => url.includes(":6080")));
  assert.ok(seen.some((url) => url.includes(":4173")));
});

test("dashboard auth uses fleet as the default username with per-agent password", () => {
  assert.deepEqual(dashboardAuthFromEnv({ HERMES_DASHBOARD_BASIC_AUTH_PASSWORD: "secret" }), {
    username: "fleet",
    password: "secret",
    available: true,
    reason: "",
    source: "instance.env",
  });
  assert.equal(dashboardAuthFromEnv({}).available, false);
});

test("dashboard auth does not invent a default password", () => {
  const auth = dashboardAuthFromEnv({ HERMES_DASHBOARD_BASIC_AUTH_USERNAME: "fleet" });

  assert.equal(auth.username, "fleet");
  assert.equal(auth.password, "");
  assert.equal(auth.reason, "password_unavailable");
});

test("local gateway URLs prefer loopback when the console is opened locally", () => {
  const local = preferredGatewayUrl({
    nodeLocal: true,
    localUrl: "http://127.0.0.1:9120",
    lanUrl: "http://192.168.3.209:9120",
    consoleHostname: "127.0.0.1",
  });
  const remote = preferredGatewayUrl({
    nodeLocal: false,
    localUrl: "http://127.0.0.1:9120",
    lanUrl: "http://192.168.3.209:9120",
    consoleHostname: "127.0.0.1",
  });

  assert.equal(local, "http://127.0.0.1:9120");
  assert.equal(remote, "http://192.168.3.209:9120");
});

test("local gateway diagnostics probe loopback endpoints", async () => {
  const seen: string[] = [];
  await diagnoseGatewayEndpoints({
    dashboard: "http://127.0.0.1:9120",
    lanDashboard: "http://192.168.3.209:9120",
    vnc: "http://127.0.0.1:6080/vnc.html",
    lanVnc: "http://192.168.3.209:6080/vnc.html",
    web: "http://127.0.0.1:9400",
    lanWeb: "http://192.168.3.209:9400",
  }, {
    nodeLocal: true,
    fetchImpl: async (input) => {
      seen.push(String(input));
      return { ok: true, status: 200 };
    },
  });

  assert.ok(seen.every((url) => url.includes("127.0.0.1")));
});
