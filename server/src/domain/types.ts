/**
 * TransitFlow domain types.
 *
 * Core idea: a bus may claim one route (red circular windshield sticker)
 * while actually running another (front LED display). A "ghost bus".
 * The server is the single source of truth for the verdict.
 */

/** Normalized verdict for a pair of route readings. */
export type Verdict = "MATCH" | "MISMATCH" | "UNCERTAIN";

export type Confidence = "HIGH" | "MEDIUM" | "LOW";

/** What the AI (or a human) read from the bus. */
export interface Extraction {
  /** Route on the red circular windshield sticker (what the bus claims). */
  stickerRoute: string | null;
  /** Route on the front LED display (what the bus is actually running). */
  ledRoute: string | null;
  confidence: Confidence;
  /** Short human-readable note from the model. */
  note?: string;
}

/** A finished AI (or manual) reading, kept server-side so a report can reference it. */
export interface Scan {
  scanId: string;
  extraction: Extraction;
  verdict: Verdict;
  source: "ai" | "manual";
  createdAt: string; // ISO-8601
}

export interface GeoPoint {
  lat: number;
  lng: number;
}

/** A commuter's confirmed report of a bus at a location. */
export interface Report {
  reportId: string;
  scanId: string | null;
  verdict: Verdict;
  stickerRoute: string | null;
  ledRoute: string | null;
  /** Free-text stop name the commuter typed. */
  stop?: string;
  /** Dataset stop that fuzzy-matched `stop`, if any. */
  matchedStop?: string;
  /** Routes normally scheduled at matchedStop (context signal). */
  expectedRoutesAtStop?: string[];
  geo?: GeoPoint;
  note?: string;
  createdAt: string;
}

/** A live radar entry created when a MISMATCH report is confirmed. */
export interface Alert {
  alertId: string;
  reportId: string;
  /** Route the bus was actually running (LED). */
  ghostRoute: string;
  /** Route the bus claimed (sticker). */
  claimedRoute: string | null;
  stop?: string;
  matchedStop?: string;
  expectedRoutesAtStop?: string[];
  geo?: GeoPoint;
  /** Community "I saw it too" confirmations. */
  confirmations: number;
  createdAt: string;
  expiresAt: string;
}

export interface Stats {
  generatedAt: string;
  routesInDataset: number;
  totalStops: number;
  activeAlerts: number;
  reportsLast24h: number;
  mismatchesLast24h: number;
  matchesLast24h: number;
  /** Top "ghosted" routes in the last 24h: how often a bus running X was reported. */
  topGhostRoutes: { route: string; count: number }[];
}

export interface RouteRecord {
  routeNumber: string;
  name: string;
  stops: string[];
}

export interface RouteSummary {
  routeNumber: string;
  name: string;
  stopCount: number;
  firstStops: string[];
}

export interface ServerMeta {
  name: string;
  version: string;
  model: string;
  storage: "memory" | "redis";
  routesInDataset: number;
  alertTtlMinutes: number;
}
