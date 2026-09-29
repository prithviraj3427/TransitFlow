import express from "express";
import cors from "cors";
import { config, isAllowedOrigin } from "./config.js";
import { routesIndex } from "./data/routesIndex.js";
import { errorHandler, notFoundHandler } from "./http/errors.js";
import { alertsRouter } from "./routes/alerts.js";
import { reportRouter } from "./routes/report.js";
import { scanRouter } from "./routes/scan.js";
import { routesApiRouter } from "./routes/routesApi.js";
import { healthRouter, metaRouter, statsRouter } from "./routes/system.js";
import type { Store } from "./store/store.js";

/**
 * Assemble the TransitFlow API app (kept separate from listen() for tests).
 */
export function createApp(store: Store): express.Express {
  const app = express();

  app.disable("x-powered-by");
  app.set("trust proxy", 1);

  // CORS: allow-list from config (defaults cover localhost + *.vercel.app / *.netlify.app).
  app.use(
    cors({
      origin(origin, callback) {
        callback(null, isAllowedOrigin(origin));
      },
      methods: ["GET", "POST", "OPTIONS"],
      allowedHeaders: ["content-type"],
      maxAge: 600,
    }),
  );

  app.use(express.json({ limit: "16mb" }));

  // Request log (compact).
  app.use((req, res, next) => {
    const start = Date.now();
    res.on("finish", () => {
      const ms = Date.now() - start;
      console.log(`${req.method} ${req.originalUrl} → ${res.statusCode} (${ms}ms)`);
    });
    next();
  });

  app.use("/api", healthRouter());          // GET  /api/health
  app.use("/api", metaRouter(store));         // GET  /api/meta
  app.use("/api", statsRouter(store));        // GET  /api/stats
  app.use("/api", routesApiRouter());         // GET  /api/routes, /api/routes/:number, /api/stops
  app.use("/api/scan", scanRouter(store));    // POST /api/scan
  app.use("/api", reportRouter(store));       // POST /api/report, /api/scans/:scanId/report
  app.use("/api/alerts", alertsRouter(store)); // GET /api/alerts, POST /api/alerts/:alertId/confirm

  app.use("/api", notFoundHandler);
  app.use(errorHandler);

  return app;
}

/** Load the route dataset once, then serve. */
export async function bootstrap(store: Store): Promise<express.Express> {
  try {
    await routesIndex.load(config.dataPath);
    console.log(
      `[transitflow] dataset: ${routesIndex.routeCount} routes, ${routesIndex.stopCount} stops`,
    );
  } catch (err) {
    console.warn(
      `[transitflow] WARNING: could not load dataset from ${config.dataPath}:`,
      err instanceof Error ? err.message : err,
    );
  }
  return createApp(store);
}
