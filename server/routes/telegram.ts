import type { Router } from "express";
import {
  cancelTelegramOnboarding,
  startTelegramOnboarding,
  telegramOnboardingStatus,
} from "../services/telegram-onboarding.ts";

export function registerTelegramRoutes(router: Router) {
  router.post("/telegram/onboarding/start", async (req, res, next) => {
    try {
      res.status(201).json(await startTelegramOnboarding(req.body || {}));
    } catch (error) {
      next(error);
    }
  });

  router.get("/telegram/onboarding/:pairingId", async (req, res, next) => {
    try {
      res.json(await telegramOnboardingStatus(req.params.pairingId));
    } catch (error) {
      next(error);
    }
  });

  router.delete("/telegram/onboarding/:pairingId", (req, res, next) => {
    try {
      res.json(cancelTelegramOnboarding(req.params.pairingId));
    } catch (error) {
      next(error);
    }
  });
}
