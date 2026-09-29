import { Router } from "express";
import { config } from "../config.js";
import { routesIndex } from "../data/routesIndex.js";
import type { Store } from "../store/store.js";

/** GET /api/health — liveness + storage mode. */
export function healthRouter(): Router {
  const router = Router();
  router.get("/health", (_req, res) => {
    res.json({ status: "ok", service: "transitflow", time: new Date().toISOString() });
  });
  return router;
}

/** GET /api/meta — app metadata for About screens. */
export function metaRouter(store: Store): Router {
  const router = Router();
  router.get("/meta", (_req, res) => {
    res.json({
      name: "TransitFlow",
      version: config.appVersion,
      model: config.geminiModel,
      storage: store.kind,
      aiEnabled: config.geminiApiKey !== undefined && config.geminiApiKey.length > 0,
      routesInDataset: routesIndex.routeCount,
      totalStops: routesIndex.stopCount,
      alertTtlMinutes: Math.round(config.alertTtlMs / 60000),
    });
  });
  return router;
}

/** GET /api/stats — radar-level aggregates. */
export function statsRouter(store: Store): Router {
  const router = Router();
  router.get("/stats", async (_req, res, next) => {
    try {
      const stats = await store.stats();
      stats.routesInDataset = routesIndex.routeCount;
      stats.totalStops = routesIndex.stopCount;
      res.json(stats);
    } catch (err) {
      next(err);
    }
  });
  return router;
}
