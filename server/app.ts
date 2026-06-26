import express from "express";
import path from "node:path";
import fs from "node:fs";
import { APP_ROOT } from "./config.ts";
import { requireConsoleAuth } from "./auth.ts";
import { registerGlobalConfigRoutes } from "./routes/global-config.ts";
import { registerInstanceRoutes } from "./routes/instances.ts";
import { registerSystemRoutes } from "./routes/system.ts";
import { registerBackupRoutes } from "./routes/backups.ts";
import { registerFleetRoutes } from "./routes/fleet.ts";
import { registerTelegramRoutes } from "./routes/telegram.ts";

export function createApp() {
  const app = express();
  const router = express.Router();
  app.disable("x-powered-by");
  app.use(express.json({ limit: "1mb" }));
  app.use("/api", requireConsoleAuth);

  registerSystemRoutes(router);
  registerFleetRoutes(router);
  registerBackupRoutes(router);
  registerGlobalConfigRoutes(router);
  registerInstanceRoutes(router);
  registerTelegramRoutes(router);
  app.use("/api", router);

  app.use((error: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    res.status(error.status || 500).json({ error: error.message || "Server error" });
  });

  const devFrontendUrl = process.env.HERMES_CONSOLE_DEV_FRONTEND_URL;
  if (devFrontendUrl) {
    app.get(/.*/, (req, res) => {
      const target = new URL(req.originalUrl || "/", devFrontendUrl);
      res.redirect(target.toString());
    });
    return app;
  }

  const dist = path.join(APP_ROOT, "dist");
  if (fs.existsSync(dist)) {
    app.use(express.static(dist));
    app.get(/.*/, (_req, res) => res.sendFile(path.join(dist, "index.html")));
  }
  return app;
}
