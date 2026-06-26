import type express from "express";
import type { IncomingMessage } from "node:http";
import { AUTH_TOKEN, REQUIRE_AUTH } from "./config.ts";

export function authRequired() {
  return Boolean(AUTH_TOKEN || REQUIRE_AUTH);
}

function bearerToken(header: string | string[] | undefined) {
  const value = Array.isArray(header) ? header[0] : header || "";
  return value.startsWith("Bearer ") ? value.slice(7) : "";
}

function validConsoleToken(token: string) {
  return Boolean(AUTH_TOKEN && token === AUTH_TOKEN);
}

function tokenFromRequest(req: express.Request) {
  return bearerToken(req.get("authorization")) || String(req.get("x-hermes-console-token") || "");
}

export function requireConsoleAuth(req: express.Request, res: express.Response, next: express.NextFunction) {
  if (!authRequired()) return next();
  if (validConsoleToken(tokenFromRequest(req))) return next();
  return res.status(401).json({ error: "Authentication required" });
}

export function upgradeAuthorized(req: IncomingMessage, url: URL) {
  if (!authRequired()) return true;
  return validConsoleToken(bearerToken(req.headers.authorization)) ||
    validConsoleToken(String(url.searchParams.get("auth") || url.searchParams.get("token") || ""));
}
