import type { Alert, Report, Scan, Stats } from "../domain/types.js";
import { normalizeRoute } from "../domain/normalize.js";
import type { AlertFilter, Store } from "./store.js";
import { distanceKm } from "./store.js";

const MAX_REPORTS = 2000;

/**
 * In-memory store. Zero dependencies; ideal for local dev and single-instance
 * hosts. Data lives until the process restarts (alerts additionally expire
 * by TTL). For durable, multi-instance storage set REDIS_URL.
 */
export class MemoryStore implements Store {
  readonly kind = "memory" as const;

  private scans = new Map<string, Scan>();
  private reports: Report[] = [];
  private alerts = new Map<string, Alert>();

  constructor(private readonly alertTtlMs: number) {}

  async createScan(scan: Scan): Promise<void> {
    this.scans.set(scan.scanId, scan);
    if (this.scans.size > 5000) {
      // Drop oldest scans first (insertion order).
      const first = this.scans.keys().next().value;
      if (first) this.scans.delete(first);
    }
  }

  async getScan(scanId: string): Promise<Scan | null> {
    return this.scans.get(scanId) ?? null;
  }

  async createReport(report: Report): Promise<void> {
    this.reports.push(report);
    if (this.reports.length > MAX_REPORTS) {
      this.reports.splice(0, this.reports.length - MAX_REPORTS);
    }
  }

  async createAlert(alert: Alert): Promise<void> {
    this.alerts.set(alert.alertId, alert);
  }

  async listAlerts(filter: AlertFilter): Promise<Alert[]> {
    const now = Date.now();
    await this.pruneExpired(now);
    let items = [...this.alerts.values()];

    if (filter.route) {
      const r = normalizeRoute(filter.route);
      if (r) {
        items = items.filter(
          (a) => normalizeRoute(a.ghostRoute) === r || normalizeRoute(a.claimedRoute) === r,
        );
      }
    }
    if (filter.stop) {
      const s = filter.stop.trim().toLowerCase();
      items = items.filter(
        (a) =>
          (a.stop ?? "").toLowerCase().includes(s) || (a.matchedStop ?? "").toLowerCase().includes(s),
      );
    }
    if (filter.lat !== undefined && filter.lng !== undefined) {
      const radius = filter.radiusKm ?? 5;
      items = items.filter(
        (a) => a.geo && distanceKm(filter.lat as number, filter.lng as number, a.geo.lat, a.geo.lng) <= radius,
      );
    }

    items.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return items.slice(0, filter.limit ?? 50);
  }

  async getAlert(alertId: string): Promise<Alert | null> {
    const alert = this.alerts.get(alertId) ?? null;
    if (alert && Date.parse(alert.expiresAt) < Date.now()) {
      this.alerts.delete(alertId);
      return null;
    }
    return alert;
  }

  async confirmAlert(alertId: string): Promise<Alert | null> {
    const alert = this.alerts.get(alertId);
    if (!alert) return null;
    alert.confirmations = Math.min(alert.confirmations + 1, 99);
    return alert;
  }

  async pruneExpired(now = Date.now()): Promise<number> {
    let removed = 0;
    for (const [id, alert] of this.alerts) {
      if (Date.parse(alert.expiresAt) < now) {
        this.alerts.delete(id);
        removed++;
      }
    }
    return removed;
  }

  async stats(): Promise<Stats> {
    await this.pruneExpired();
    const dayAgo = Date.now() - 24 * 3600_000;
    const recent = this.reports.filter((r) => Date.parse(r.createdAt) >= dayAgo);
    const mismatches = recent.filter((r) => r.verdict === "MISMATCH");
    const matches = recent.filter((r) => r.verdict === "MATCH");

    const ghostCounts = new Map<string, number>();
    for (const r of mismatches) {
      const route = normalizeRoute(r.ledRoute) ?? "?";
      ghostCounts.set(route, (ghostCounts.get(route) ?? 0) + 1);
    }
    const top = [...ghostCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([route, count]) => ({ route, count }));

    return {
      generatedAt: new Date().toISOString(),
      routesInDataset: 0, // filled by the caller (routesIndex knows the dataset)
      totalStops: 0,
      activeAlerts: this.alerts.size,
      reportsLast24h: recent.length,
      mismatchesLast24h: mismatches.length,
      matchesLast24h: matches.length,
      topGhostRoutes: top,
    };
  }

}
