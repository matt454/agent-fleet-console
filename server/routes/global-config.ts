import type { Router } from "express";
import { HERMES_PROVIDER_CATALOG_FALLBACK } from "../catalog.ts";
import { validators } from "../config.ts";
import {
  deleteGlobalCredential,
  globalConfig,
  setGlobalCredential,
  writeGlobalProvider,
  importGlobalConfigBundle,
} from "../services/global-config.ts";
import { createJob } from "../services/jobs.ts";
import { getOauthSession, startOauth } from "../services/oauth.ts";

function normalizeSyncPayload(body: any) {
  if (Array.isArray(body?.names)) {
    return {
      scoped: true,
      names: body.names.map((name: unknown) => validators.validateName(name)).filter(Boolean),
    };
  }
  if (Array.isArray(body?.targets)) {
    const names = body.targets
      .map((target: any) => ({
        nodeId: String(target?.nodeId || "local").trim() || "local",
        name: validators.validateName(target?.name || ""),
      }))
      .filter((target: { nodeId: string; name: string }) => target.nodeId === "local" && target.name)
      .map((target: { name: string }) => target.name);
    return { scoped: true, names };
  }
  return { scoped: false, names: [] };
}

function normalizeCustomEndpoints(value: unknown, provider: string, baseUrl: string) {
  const rawEndpoints = Array.isArray(value) ? value : [];
  const endpoints = rawEndpoints
    .map((item) => validators.normalizeLocalProviderBaseUrl(
      validators.validateProviderBaseUrl(item || ""),
      provider,
    ))
    .filter(Boolean);
  if (provider === "custom" && baseUrl) endpoints.unshift(baseUrl);
  return [...new Set(endpoints)].slice(0, 12);
}

export function registerGlobalConfigRoutes(router: Router) {
  router.get("/hermes-provider-catalog", (_req, res) => {
    res.json({ providers: HERMES_PROVIDER_CATALOG_FALLBACK, source: "bundled", error: "" });
  });

  router.get("/global-config", async (_req, res, next) => {
    try {
      res.json(await globalConfig());
    } catch (error) {
      next(error);
    }
  });

  router.put("/global-config/provider", async (req, res, next) => {
    try {
      const provider = validators.validateProviderId(req.body?.provider);
      const model = String(req.body?.model || "");
      const baseUrl = validators.normalizeLocalProviderBaseUrl(
        validators.validateProviderBaseUrl(req.body?.baseUrl || ""),
        provider,
      );
      const customEndpoints = normalizeCustomEndpoints(req.body?.customEndpoints, provider, baseUrl);
      await writeGlobalProvider({ provider, model, baseUrl, customEndpoints });
      res.json(await globalConfig());
    } catch (error) {
      next(error);
    }
  });

  router.put("/global-config/credentials", async (req, res, next) => {
    try {
      const key = validators.validateCredentialKey(req.body?.key);
      await setGlobalCredential(key, validators.validateCredentialValue(req.body?.value, key));
      res.json(await globalConfig());
    } catch (error) {
      next(error);
    }
  });

  router.delete("/global-config/credentials/:key", async (req, res, next) => {
    try {
      await deleteGlobalCredential(validators.validateCredentialKey(req.params.key));
      res.json(await globalConfig());
    } catch (error) {
      next(error);
    }
  });

  router.post("/global-config/oauth/start", async (req, res, next) => {
    try {
      res.status(202).json({ session: await startOauth(String(req.body?.provider || "")) });
    } catch (error) {
      next(error);
    }
  });

  router.get("/global-config/oauth/:provider/:sessionId", (req, res) => {
    const session = getOauthSession(req.params.provider, req.params.sessionId);
    if (!session) return res.status(404).json({ error: "OAuth session not found" });
    return res.json({ session });
  });

  router.post("/global-config/sync", (req, res, next) => {
    try {
      const sync = normalizeSyncPayload(req.body || {});
      res.status(202).json({ job: createJob("global-config-sync", "", sync.scoped ? { names: sync.names, scoped: true } : {}, req.ip || "local") });
    } catch (error) {
      next(error);
    }
  });

  router.post("/global-config/import", async (req, res, next) => {
    try {
      res.json(await importGlobalConfigBundle(req.body || {}));
    } catch (error) {
      next(error);
    }
  });
}
