import type { Alert, Report, Scan, Stats } from "../domain/types.js";

export interface AlertFilter {
  /** Match ghost route or claimed route (normalized comparison). */
  route?: string;
  /** Substring match against stop / matchedStop. */
  stop?: string;
  /** Haversine filter around a point. */
  lat?: number;
  lng?: number;
  radiusKm?: number;
  limit?: number;
}

/**
 * Storage contract. Implementations: MemoryStore (default) and RedisStore.
 * All methods are async so implementations can be swapped freely.
 */
export interface Store {
  readonly kind: "memory" | "redis";

  createScan(scan: Scan): Promise<void>;
  getScan(scanId: string): Promise<Scan | null>;

  createReport(report: Report): Promise<void>;

  createAlert(alert: Alert): Promise<void>;
  listAlerts(filter: AlertFilter): Promise<Alert[]>;
  getAlert(alertId: string): Promise<Alert | null>;
  confirmAlert(alertId: string): Promise<Alert | null>;

  /** Drop expired alerts; returns how many were removed. */
  pruneExpired(now?: number): Promise<number>;

  stats(): Promise<Stats>;
}

/** Haversine distance in km. */
export function distanceKm(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}
