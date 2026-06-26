import type { Router } from "express";
import { validators } from "../config.ts";
import {
  createFleetNode,
  deleteFleetNode,
  fleetOverview,
  listFleetNodes,
  proxyBackupExport,
  proxyBackupDownload,
  proxyBackupInspect,
  proxyBackups,
  proxyCancelTelegramOnboarding,
  proxyChatRunStatus,
  proxyCredentials,
  proxyCrons,
  proxyCreateInstance,
  proxyGateway,
  proxyInstance,
  proxyInstanceDisplayName,
  proxyClone,
  proxyConsoleGitUpdateRestart,
  proxyConsoleGitUpdateStatus,
  proxyInstanceAction,
  proxyJobCancel,
  proxyJobStatus,
  proxyPaymentPolicy,
  proxySessionChat,
  proxySessionMessages,
  proxySessions,
  proxyStartTelegramOnboarding,
  proxyStopChatRun,
  proxyTelegramOnboardingStatus,
  proxyTelegramSetup,
  proxyTerminalTicket,
  syncGlobalConfigAcrossFleetTargets,
  testFleetNode,
  updateFleetNode,
} from "../services/fleet-nodes.ts";

export function registerFleetRoutes(router: Router) {
  router.get("/fleet/overview", async (req, res, next) => {
    try {
      res.json(await fleetOverview({ refreshVersions: req.query.refreshVersions === "1" }));
    } catch (error) {
      next(error);
    }
  });

  router.get("/fleet/nodes", (_req, res) => {
    res.json({ nodes: listFleetNodes() });
  });

  router.post("/fleet/nodes", (req, res, next) => {
    try {
      res.status(201).json({ node: createFleetNode(req.body || {}) });
    } catch (error) {
      next(error);
    }
  });

  router.put("/fleet/nodes/:nodeId", (req, res, next) => {
    try {
      res.json({ node: updateFleetNode(req.params.nodeId, req.body || {}) });
    } catch (error) {
      next(error);
    }
  });

  router.delete("/fleet/nodes/:nodeId", (req, res, next) => {
    try {
      res.json(deleteFleetNode(req.params.nodeId));
    } catch (error) {
      next(error);
    }
  });

  router.post("/fleet/nodes/:nodeId/test", async (req, res, next) => {
    try {
      res.json({ node: await testFleetNode(req.params.nodeId) });
    } catch (error) {
      next(error);
    }
  });

  router.post("/fleet/:nodeId/instances", async (req, res, next) => {
    try {
      res.status(202).json(await proxyCreateInstance(req.params.nodeId, req.body || {}, req.ip || "local"));
    } catch (error) {
      next(error);
    }
  });

  router.post("/fleet/:nodeId/telegram/onboarding/start", async (req, res, next) => {
    try {
      res.status(201).json(await proxyStartTelegramOnboarding(req.params.nodeId, req.body || {}));
    } catch (error) {
      next(error);
    }
  });

  router.get("/fleet/:nodeId/telegram/onboarding/:pairingId", async (req, res, next) => {
    try {
      res.json(await proxyTelegramOnboardingStatus(req.params.nodeId, req.params.pairingId));
    } catch (error) {
      next(error);
    }
  });

  router.delete("/fleet/:nodeId/telegram/onboarding/:pairingId", async (req, res, next) => {
    try {
      res.json(await proxyCancelTelegramOnboarding(req.params.nodeId, req.params.pairingId));
    } catch (error) {
      next(error);
    }
  });

  router.post("/fleet/:nodeId/instances/:name/actions", async (req, res, next) => {
    try {
      const name = validators.validateName(req.params.name);
      const action = validators.validateAction(req.body?.action);
      res.status(202).json(await proxyInstanceAction(req.params.nodeId, name, action, req.body || {}, req.ip || "local"));
    } catch (error) {
      next(error);
    }
  });

  router.get("/fleet/:nodeId/instances/:name", async (req, res, next) => {
    try {
      res.json(await proxyInstance(req.params.nodeId, validators.validateName(req.params.name)));
    } catch (error) {
      next(error);
    }
  });

  router.put("/fleet/:nodeId/instances/:name/display-name", async (req, res, next) => {
    try {
      res.json(await proxyInstanceDisplayName(req.params.nodeId, validators.validateName(req.params.name), req.body || {}));
    } catch (error) {
      next(error);
    }
  });

  router.post("/fleet/:nodeId/instances/:name/clone", async (req, res, next) => {
    try {
      const name = validators.validateName(req.params.name);
      res.status(202).json(await proxyClone(req.params.nodeId, name, req.body || {}, req.ip || "local"));
    } catch (error) {
      next(error);
    }
  });

  router.post("/fleet/:nodeId/instances/:name/telegram", async (req, res, next) => {
    try {
      const name = validators.validateName(req.params.name);
      res.status(202).json(await proxyTelegramSetup(req.params.nodeId, name, req.body || {}, req.ip || "local"));
    } catch (error) {
      next(error);
    }
  });

  router.post("/fleet/:nodeId/backups/export", async (req, res, next) => {
    try {
      res.status(202).json(await proxyBackupExport(req.params.nodeId, req.body || {}, req.ip || "local"));
    } catch (error) {
      next(error);
    }
  });

  router.post("/fleet/:nodeId/jobs/:jobId/cancel", async (req, res, next) => {
    try {
      res.json(await proxyJobCancel(req.params.nodeId, Number(req.params.jobId)));
    } catch (error) {
      next(error);
    }
  });

  router.get("/fleet/:nodeId/jobs/:jobId", async (req, res, next) => {
    try {
      res.json(await proxyJobStatus(req.params.nodeId, Number(req.params.jobId)));
    } catch (error) {
      next(error);
    }
  });

  router.get("/fleet/:nodeId/instances/:name/gateway", async (req, res, next) => {
    try {
      res.json(await proxyGateway(req.params.nodeId, validators.validateName(req.params.name)));
    } catch (error) {
      next(error);
    }
  });

  router.get("/fleet/:nodeId/instances/:name/sessions", async (req, res, next) => {
    try {
      res.json(await proxySessions(req.params.nodeId, validators.validateName(req.params.name), Number(req.query.limit || 20), Number(req.query.offset || 0)));
    } catch (error) {
      next(error);
    }
  });

  router.get("/fleet/:nodeId/instances/:name/sessions/:sessionId/messages", async (req, res, next) => {
    try {
      res.json(await proxySessionMessages(req.params.nodeId, validators.validateName(req.params.name), validators.validateSessionId(req.params.sessionId)));
    } catch (error) {
      next(error);
    }
  });

  router.post("/fleet/:nodeId/instances/:name/sessions/chat", async (req, res, next) => {
    try {
      const name = validators.validateName(req.params.name);
      const message = validators.validateChatMessage(req.body?.message || "");
      const sessionId = req.body?.sessionId ? validators.validateSessionId(req.body.sessionId) : "";
      const executionPolicy = req.body?.executionPolicy === "bypass-approvals" ? "bypass-approvals" : "default";
      res.status(202).json(await proxySessionChat(req.params.nodeId, name, { sessionId, message, executionPolicy }, req.ip || "local"));
    } catch (error) {
      next(error);
    }
  });

  router.get("/fleet/:nodeId/instances/:name/sessions/runs/:runId", async (req, res, next) => {
    try {
      res.json(await proxyChatRunStatus(req.params.nodeId, validators.validateName(req.params.name), validators.validateSessionId(req.params.runId)));
    } catch (error) {
      next(error);
    }
  });

  router.post("/fleet/:nodeId/instances/:name/sessions/runs/:runId/stop", async (req, res, next) => {
    try {
      res.json(await proxyStopChatRun(req.params.nodeId, validators.validateName(req.params.name), validators.validateSessionId(req.params.runId)));
    } catch (error) {
      next(error);
    }
  });

  router.get("/fleet/:nodeId/instances/:name/terminal-ticket", async (req, res, next) => {
    try {
      res.json(await proxyTerminalTicket(req.params.nodeId, validators.validateName(req.params.name)));
    } catch (error) {
      next(error);
    }
  });

  router.get("/fleet/:nodeId/instances/:name/crons", async (req, res, next) => {
    try {
      res.json(await proxyCrons(req.params.nodeId, validators.validateName(req.params.name)));
    } catch (error) {
      next(error);
    }
  });

  router.get("/fleet/:nodeId/instances/:name/credentials", async (req, res, next) => {
    try {
      res.json(await proxyCredentials(req.params.nodeId, validators.validateName(req.params.name)));
    } catch (error) {
      next(error);
    }
  });

  router.get("/fleet/:nodeId/instances/:name/payment-policy", async (req, res, next) => {
    try {
      res.json(await proxyPaymentPolicy(req.params.nodeId, validators.validateName(req.params.name)));
    } catch (error) {
      next(error);
    }
  });

  router.get("/fleet/:nodeId/backups", async (req, res, next) => {
    try {
      res.json(await proxyBackups(req.params.nodeId));
    } catch (error) {
      next(error);
    }
  });

  router.get("/fleet/:nodeId/backups/:file/download", async (req, res, next) => {
    try {
      const file = validators.validateBackupFilename(req.params.file);
      const result = await proxyBackupDownload(req.params.nodeId, file);
      if ("localPath" in result) return res.download(result.localPath, result.file);
      if (!result.ok) return res.status(result.status).json({ error: `HTTP ${result.status}` });
      res.setHeader("Content-Disposition", `attachment; filename="${file}"`);
      result.body?.pipeTo(new WritableStream({
        write(chunk) { res.write(Buffer.from(chunk)); },
        close() { res.end(); },
        abort(error) { next(error); },
      }));
    } catch (error) {
      next(error);
    }
  });

  router.post("/fleet/:nodeId/backups/inspect", async (req, res, next) => {
    try {
      res.json(await proxyBackupInspect(req.params.nodeId, req.body || {}));
    } catch (error) {
      next(error);
    }
  });

  router.post("/fleet/global-config/sync", async (req, res, next) => {
    try {
      res.status(202).json(await syncGlobalConfigAcrossFleetTargets(req.body?.targets || [], req.ip || "local"));
    } catch (error) {
      next(error);
    }
  });

  router.post("/fleet/global-config/sync-targets", async (req, res, next) => {
    try {
      if (!Array.isArray(req.body?.targets) || !req.body.targets.length) {
        return res.status(400).json({ error: "Target agents are required" });
      }
      res.status(202).json(await syncGlobalConfigAcrossFleetTargets(req.body.targets, req.ip || "local"));
    } catch (error) {
      next(error);
    }
  });

  router.post("/fleet/:nodeId/console/git-update-restart", async (req, res, next) => {
    try {
      res.status(202).json(await proxyConsoleGitUpdateRestart(req.params.nodeId));
    } catch (error) {
      next(error);
    }
  });

  router.get("/fleet/:nodeId/console/git-update-restart/status", async (req, res, next) => {
    try {
      res.json(await proxyConsoleGitUpdateStatus(req.params.nodeId));
    } catch (error) {
      next(error);
    }
  });
}
