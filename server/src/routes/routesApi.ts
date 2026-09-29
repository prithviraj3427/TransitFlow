import { Router } from "express";
import { routesIndex } from "../data/routesIndex.js";
import { HttpError } from "../http/errors.js";

/**
 * GET /api/routes?q=          — search routes (number, name, stop)
 * GET /api/routes/:number     — exact route detail (case/space tolerant)
 * GET /api/stops              — stop names for autocomplete
 */
export function routesApiRouter(): Router {
  const router = Router();

  router.get("/routes", (req, res, next) => {
    try {
      const q = typeof req.query.q === "string" ? req.query.q : "";
      const limit = Math.min(Math.max(Number(req.query.limit ?? 12) || 12, 1), 30);
      res.json({ routes: routesIndex.search(q, limit) });
    } catch (err) {
      next(err);
    }
  });

  router.get("/routes/:number", (req, res, next) => {
    try {
      const record = routesIndex.getRoute(String(req.params.number ?? ""));
      if (!record) throw HttpError.notFound(`Route ${String(req.params.number ?? "").trim()} isn't in our dataset yet.`);
      res.json({ route: record });
    } catch (err) {
      next(err);
    }
  });

  router.get("/stops", (_req, res) => {
    const limit = Math.min(Number(_req.query.limit ?? 600) || 600, 1200);
    res.json({ stops: routesIndex.listStops(limit) });
  });

  return router;
}
