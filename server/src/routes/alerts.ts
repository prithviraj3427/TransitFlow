import { Router } from "express";
import { config } from "../config.js";
import { HttpError } from "../http/errors.js";
import { rateLimit } from "../http/rateLimit.js";
import type { Store } from "../store/store.js";

function num(value: unknown): number | undefined {
  if (typeof value !== "string" && typeof value !== "number") return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

/**
 * GET  /api/alerts?route=&stop=&lat=&lng=&radiusKm=&limit=
 * POST /api/alerts/:alertId/confirm
 */
export function alertsRouter(store: Store): Router {
  const router = Router();

  router.get("/", async (_req, res, next) => {
    try {
      const q = _req.query as Record<string, unknown>;
      const lat = num(q.lat);
      const lng = num(q.lng);
      const radiusKm = num(q.radiusKm);
      const alerts = await store.listAlerts({
        route: typeof q.route === "string" ? q.route : undefined,
        stop: typeof q.stop === "string" ? q.stop : undefined,
        lat,
        lng,
        radiusKm: radiusKm ? Math.min(Math.max(radiusKm, 0.5), 50) : undefined,
        limit: Math.min(Math.max(num(q.limit) ?? 50, 1), 50),
      });
      res.json({ alerts, count: alerts.length, generatedAt: new Date().toISOString() });
    } catch (err) {
      next(err);
    }
  });

  router.post(
    "/:alertId/confirm",
    rateLimit({ key: "confirm", max: config.confirmRateLimit.max, windowMs: config.confirmRateLimit.windowMs }),
    async (req, res, next) => {
      try {
        const alert = await store.confirmAlert(String(req.params.alertId ?? ""));
        if (!alert) throw HttpError.notFound("That alert has expired or is no longer active.");
        res.json({ alertId: alert.alertId, confirmations: alert.confirmations });
      } catch (err) {
        next(err);
      }
    },
  );

  return router;
}
