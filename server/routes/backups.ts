import path from "node:path";
import type { Router } from "express";
import { validators } from "../config.ts";
import { createJob } from "../services/jobs.ts";
import { inspectBackup, listBackups } from "../services/backups.ts";
import { safeArchivePath } from "../services/backup-files.ts";

export function registerBackupRoutes(router: Router) {
  router.get("/backups", async (_req, res, next) => {
    try {
      res.json({ backups: await listBackups() });
    } catch (error) {
      next(error);
    }
  });

  router.get("/backups/:file/download", (req, res, next) => {
    try {
      const file = validators.validateBackupFilename(req.params.file);
      res.download(safeArchivePath(file), file);
    } catch (error) {
      next(error);
    }
  });

  router.post("/backups/export", (req, res) => {
    const payload = validators.normalizeBackupExport(req.body || {});
    res.status(202).json({ job: createJob("backup-export", payload.names?.[0] || "", payload, req.ip || "local") });
  });

  router.post("/backups/inspect", async (req, res, next) => {
    try {
      const archivePath = validators.validateBackupArchivePath(req.body?.archivePath);
      res.json(await inspectBackup(path.resolve(archivePath)));
    } catch (error) {
      next(error);
    }
  });

  router.post("/backups/restore", (req, res) => {
    const payload = validators.normalizeBackupRestore(req.body || {});
    res.status(202).json({ job: createJob("backup-restore", "", payload, req.ip || "local") });
  });
}
