/**
 * Shared API contract types — mirrors the core API (Part A) responses.
 * Keep in sync with server/src/domain/types.ts.
 */

export type Verdict = "MATCH" | "MISMATCH" | "UNCERTAIN";
export type Confidence = "HIGH" | "MEDIUM" | "LOW";

export interface Extraction {
  stickerRoute: string | null;
  ledRoute: string | null;
  confidence: Confidence;
  note?: string;
}

export interface ScanResult {
  scanId: string;
  verdict: Verdict;
  extraction: Extraction;
  createdAt: string;
}

export interface Alert {
  alertId: string;
  reportId: string;
  ghostRoute: string;
  claimedRoute: string | null;
  stop?: string;
  matchedStop?: string;
  expectedRoutesAtStop?: string[];
  geo?: { lat: number; lng: number };
  confirmations: number;
  createdAt: string;
  expiresAt: string;
}

export interface AlertList {
  alerts: Alert[];
  count: number;
  generatedAt: string;
}

export interface ConfirmResponse {
  alertId: string;
  confirmations: number;
}

export interface ReportResponse {
  reportId: string;
  verdict: Verdict;
  alert: {
    alertId: string;
    ghostRoute: string;
    claimedRoute: string | null;
    expiresAt: string;
    confirmations: number;
  } | null;
  matchedStop: string | null;
  expectedRoutesAtStop: string[];
  createdAt: string;
}

export interface RouteSummary {
  routeNumber: string;
  name: string;
  stopCount: number;
  firstStops: string[];
}

export interface RouteRecord {
  routeNumber: string;
  name: string;
  stops: string[];
}

export interface Stats {
  generatedAt: string;
  routesInDataset: number;
  totalStops: number;
  activeAlerts: number;
  reportsLast24h: number;
  mismatchesLast24h: number;
  matchesLast24h: number;
  topGhostRoutes: { route: string; count: number }[];
}

export interface Meta {
  name: string;
  version: string;
  model: string;
  storage: "memory" | "redis";
  aiEnabled: boolean;
  routesInDataset: number;
  totalStops: number;
  alertTtlMinutes: number;
}
