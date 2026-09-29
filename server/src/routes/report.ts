import { Router } from "express";
import { config } from "../config.js";
import { routesIndex } from "../data/routesIndex.js";
import { decide } from "../domain/decision.js";
import { alertId, reportId } from "../domain/ids.js";
import { HttpError } from "../http/errors.js";
import { rateLimit } from "../http/rateLimit.js";
import type { Store } from "../store/store.js";
import type { Alert, Report, Scan } from "../domain/types.js";

interface ReportBody {
  /** Manual readings — override (or replace) the AI scan when provided. */
  stickerRoute?: string | null;
  ledRoute?: string | null;
  /** Free-text location typed by the commuter. */
  stop?: string;
  lat?: number;
  lng?: number;
  note?: string;
}

function parseGeo(body: ReportBody): { lat: number; lng: number } | undefined {
  if (typeof body.lat === "number" && typeof body.lng === "number" &&
      Number.isFinite(body.lat) && Number.isFinite(body.lng) &&
      Math.abs(body.lat) <= 90 && Math.abs(body.lng) <= 180) {
    return { lat: body.lat, lng: body.lng };
  }
  return undefined;
}

function parseOptionalRoute(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const s = String(value).trim();
  if (s === "" || s.toLowerCase() === "null") return null;
  return s;
}

/**
 * Core reporting pipeline (the heart of TransitFlow's logic):
 *
 *  1. Resolve the two readings (from the stored AI scan, or manual input).
 *  2. Compute the verdict server-side (single source of truth).
 *  3. Fuzzy-match the commuter's location against the dataset stops and
 *     attach "routes normally expected here" as context.
 *  4. Persist the report; if MISMATCH, publish a live radar alert with TTL.
 */
export function buildReport(
  store: Store,
  scan: Scan | null,
  body: ReportBody,
): { report: Report; alert: Alert | null } {
  const sticker = parseOptionalRoute(body.stickerRoute) ?? scan?.extraction.stickerRoute ?? null;
  const led = parseOptionalRoute(body.ledRoute) ?? scan?.extraction.ledRoute ?? null;

  const verdict = decide(sticker, led);
  if (verdict === "UNCERTAIN") {
    throw HttpError.badRequest(
      "We need both route numbers to make a call. Tell us what the sticker says and what the LED display shows.",
    );
  }

  const now = new Date();
  const geo = parseGeo(body);
  const typedStop = typeof body.stop === "string" ? body.stop.trim() : "";

  let matchedStop: string | undefined;
  let expectedRoutesAtStop: string[] | undefined;
  if (typedStop) {
    const match = routesIndex.expectedRoutesAt(typedStop);
    if (match) {
      matchedStop = match.stop;
      expectedRoutesAtStop = match.expectedRoutes.slice(0, 8);
    }
  }

  const report: Report = {
    reportId: reportId(),
    scanId: scan?.scanId ?? null,
    verdict,
    stickerRoute: sticker,
    ledRoute: led,
    stop: typedStop || undefined,
    matchedStop,
    expectedRoutesAtStop,
    geo,
    note: typeof body.note === "string" && body.note.trim() ? body.note.trim().slice(0, 280) : undefined,
    createdAt: now.toISOString(),
  };

  let alert: Alert | null = null;
  if (verdict === "MISMATCH" && led) {
    alert = {
      alertId: alertId(),
      reportId: report.reportId,
      ghostRoute: led,
      claimedRoute: sticker,
      stop: report.stop,
      matchedStop,
      expectedRoutesAtStop,
      geo,
      confirmations: 0,
      createdAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + config.alertTtlMs).toISOString(),
    };
  }

  return { report, alert };
}

export function reportRouter(store: Store): Router {
  const router = Router();
  const limit = rateLimit({ key: "report", max: config.reportRateLimit.max, windowMs: config.reportRateLimit.windowMs });

  async function handle(req: { body?: unknown }, res: import("express").Response, scan: Scan | null): Promise<void> {
    const body = (req.body ?? {}) as ReportBody;
    const { report, alert } = buildReport(store, scan, body);
    await store.createReport(report);
    if (alert) await store.createAlert(alert);
    res.status(201).json({
      reportId: report.reportId,
      verdict: report.verdict,
      alert: alert
        ? {
            alertId: alert.alertId,
            ghostRoute: alert.ghostRoute,
            claimedRoute: alert.claimedRoute,
            expiresAt: alert.expiresAt,
            confirmations: alert.confirmations,
          }
        : null,
      matchedStop: report.matchedStop ?? null,
      expectedRoutesAtStop: report.expectedRoutesAtStop ?? [],
      createdAt: report.createdAt,
    });
  }

  // Confirm an AI scan with location + optional manual corrections.
  router.post("/scans/:scanId/report", limit, async (req, res, next) => {
    try {
      const scanIdValue = String(req.params.scanId ?? "");
      const scan = await store.getScan(scanIdValue);
      if (!scan) {
        throw HttpError.notFound("That scan has expired. Please take a fresh photo.");
      }
      await handle(req, res, scan);
    } catch (err) {
      next(err);
    }
  });

  // Fully manual report (no photo).
  router.post("/report", limit, async (req, res, next) => {
    try {
      await handle(req, res, null);
    } catch (err) {
      next(err);
    }
  });

  return router;
}
