import test from "node:test";
import assert from "node:assert/strict";
import { devFrontendRedirectUrl } from "../server/app.ts";

test("dev frontend redirects use request host for LAN clients", () => {
  assert.equal(
    devFrontendRedirectUrl("http://localhost:5200", "/sessions", "192.168.3.232:5180"),
    "http://192.168.3.232:5200/sessions",
  );
});

test("dev frontend redirects keep localhost for local clients", () => {
  assert.equal(
    devFrontendRedirectUrl("http://localhost:5200", "/sessions", "127.0.0.1:5180"),
    "http://localhost:5200/sessions",
  );
});
