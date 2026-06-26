import type { Router } from "express";
import { ALLOW_SELF_UPDATE, APP_ROOT, DATA_DIR, ROOT } from "../config.ts";
import { authRequired } from "../auth.ts";
import { db } from "../database.ts";
import { recentEvents } from "../services/records.ts";
import { getJob, recentJobs, cancelJob } from "../services/jobs.ts";
import { baselineStatus } from "../services/baseline.ts";
import { consoleGitUpdateStatus, startConsoleGitUpdateRestart } from "../services/console-update.ts";
import { consoleVersion } from "../services/console-version.ts";

export function registerSystemRoutes(router: Router) {
  router.get("/health", (_req, res) => {
    res.json({ ok: true, root: ROOT, dataDir: DATA_DIR, appRoot: APP_ROOT, console: consoleVersion() });
  });

  router.get("/setup/baseline", (_req, res) => {
    res.json(baselineStatus());
  });

  router.get("/security", (_req, res) => {
    const audit = db.prepare("SELECT COUNT(*) AS count, MAX(created_at) AS latest FROM audit_log").get();
    res.json({ authRequired: authRequired(), selfUpdateAllowed: ALLOW_SELF_UPDATE, audit });
  });

  router.get("/events", (req, res) => {
    res.json({ events: recentEvents(String(req.query.instance || ""), Number(req.query.limit || 50)) });
  });

  router.get("/jobs", (req, res) => {
    res.json({ jobs: recentJobs(Number(req.query.limit || 50)) });
  });

  router.get("/jobs/:id", (req, res) => {
    const job = getJob(Number(req.params.id));
    if (!job) return res.status(404).json({ error: "Job not found" });
    return res.json({ job });
  });

  router.post("/jobs/:id/cancel", (req, res) => {
    res.json({ job: cancelJob(Number(req.params.id)) });
  });

  router.post("/system/git-update-restart", (_req, res, next) => {
    try {
      res.status(202).json(startConsoleGitUpdateRestart());
    } catch (error) {
      next(error);
    }
  });

  router.get("/system/git-update-restart/status", (_req, res) => {
    res.json(consoleGitUpdateStatus());
  });

}
