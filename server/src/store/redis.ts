import { Redis } from "ioredis";
import type { Alert, Report, Scan, Stats } from "../domain/types.js";
import { normalizeRoute } from "../domain/normalize.js";
import type { AlertFilter, Store } from "./store.js";
import { distanceKm } from "./store.js";

/**
 * Redis-backed store (Vercel KV, Upstash, or any Redis).
 *
 * Layout:
 *   tf:scan:<id>        hash   (TTL 24h)
 *   tf:report:<id>      hash   (TTL 7d)
 *   tf:alert:<id>       hash   (TTL = alert lifetime)
 *   tf:alerts:active    zset   score=expiresAtMs, member=alertId
 *   tf:reports:recent   zset   score=createdAtMs, member=reportId (capped)
 *   tf:stats:day:<d>    hash   {reports, mismatches, matches}
 *   tf:stats:day:<d>:ghost:<route>  counter (INCR)
 */
export class RedisStore implements Store {
  readonly kind = "redis" as const;
  private redis: Redis;

  constructor(
    url: string,
    private readonly dayPrefix: () => string,
  ) {
    this.redis = new Redis(url, {
      maxRetriesPerRequest: 2,
      lazyConnect: false,
      retryStrategy: (times) => (times > 10 ? null : Math.min(times * 200, 2000)),
    });
    this.redis.on("error", (err) => {
      console.error("[transitflow] redis error:", err.message);
    });
  }

  private static field(value: unknown): string | null {
    if (value === null || value === undefined) return null;
    const s = String(value).trim();
    return s === "" ? null : s;
  }

  async createScan(scan: Scan): Promise<void> {
    const h = {
      scanId: scan.scanId,
      extraction: JSON.stringify(scan.extraction),
      verdict: scan.verdict,
      source: scan.source,
      createdAt: scan.createdAt,
    };
    await this.redis.hset(`tf:scan:${scan.scanId}`, Object.entries(h).flat() as (string)[]);
    await this.redis.expire(`tf:scan:${scan.scanId}`, 60 * 60 * 24);
  }

  async getScan(scanId: string): Promise<Scan | null> {
    const h = await this.redis.hgetall(`tf:scan:${scanId}`);
    if (!h || !h.verdict) return null;
    return {
      scanId: h.scanId ?? scanId,
      extraction: JSON.parse(h.extraction ?? "{}") as Scan["extraction"],
      verdict: h.verdict as Scan["verdict"],
      source: (h.source as Scan["source"]) ?? "ai",
      createdAt: h.createdAt ?? new Date(0).toISOString(),
    };
  }

  async createReport(report: Report): Promise<void> {
    const key = `tf:report:${report.reportId}`;
    const h: Record<string, string> = {
      reportId: report.reportId,
      scanId: report.scanId ?? "",
      verdict: report.verdict,
      stickerRoute: report.stickerRoute ?? "",
      ledRoute: report.ledRoute ?? "",
      stop: report.stop ?? "",
      matchedStop: report.matchedStop ?? "",
      expectedRoutesAtStop: JSON.stringify(report.expectedRoutesAtStop ?? []),
      lat: report.geo ? String(report.geo.lat) : "",
      lng: report.geo ? String(report.geo.lng) : "",
      note: report.note ?? "",
      createdAt: report.createdAt,
    };
    await this.redis.hset(key, Object.entries(h).flat() as string[]);
    await this.redis.expire(key, 7 * 24 * 3600);

    const nowMs = Date.now();
    await this.redis.zadd("tf:reports:recent", nowMs, report.reportId);
    await this.redis.zremrangebyrank("tf:reports:recent", 0, -2001);

    const dayKey = `tf:stats:day:${this.dayPrefix()}`;
    const pipeline = this.redis.multi();
    pipeline.incr(`${dayKey}:reports`);
    if (report.verdict === "MISMATCH") {
      pipeline.incr(`${dayKey}:mismatches`);
      const route = normalizeRoute(report.ledRoute) ?? "unknown";
      pipeline.incr(`${dayKey}:ghost:${route}`);
    } else if (report.verdict === "MATCH") {
      pipeline.incr(`${dayKey}:matches`);
    }
    pipeline.expire(`${dayKey}:reports`, 48 * 3600);
    pipeline.expire(`${dayKey}:mismatches`, 48 * 3600);
    pipeline.expire(`${dayKey}:matches`, 48 * 3600);
    await pipeline.exec();
  }

  async createAlert(alert: Alert): Promise<void> {
    const key = `tf:alert:${alert.alertId}`;
    const h: Record<string, string> = {
      alertId: alert.alertId,
      reportId: alert.reportId,
      ghostRoute: alert.ghostRoute,
      claimedRoute: alert.claimedRoute ?? "",
      stop: alert.stop ?? "",
      matchedStop: alert.matchedStop ?? "",
      expectedRoutesAtStop: JSON.stringify(alert.expectedRoutesAtStop ?? []),
      lat: alert.geo ? String(alert.geo.lat) : "",
      lng: alert.geo ? String(alert.geo.lng) : "",
      confirmations: String(alert.confirmations),
      createdAt: alert.createdAt,
      expiresAt: alert.expiresAt,
    };
    const ttl = Math.max(1, Math.ceil((Date.parse(alert.expiresAt) - Date.now()) / 1000));
    await this.redis.hset(key, Object.entries(h).flat() as string[]);
    await this.redis.expire(key, ttl);
    await this.redis.zadd("tf:alerts:active", Date.parse(alert.expiresAt), alert.alertId);
  }

  private async hydrate(id: string): Promise<Alert | null> {
    const h = await this.redis.hgetall(`tf:alert:${id}`);
    if (!h || Object.keys(h).length === 0) return null; // hgetall returns {} when missing
    return {
      alertId: h.alertId ?? id,
      reportId: h.reportId ?? "",
      ghostRoute: h.ghostRoute ?? "",
      claimedRoute: h.claimedRoute || null,
      stop: h.stop || undefined,
      matchedStop: h.matchedStop || undefined,
      expectedRoutesAtStop: safeParseArray(h.expectedRoutesAtStop),
      geo: h.lat && h.lng ? { lat: Number(h.lat), lng: Number(h.lng) } : undefined,
      confirmations: Number(h.confirmations ?? 0),
      createdAt: h.createdAt ?? new Date(0).toISOString(),
      expiresAt: h.expiresAt ?? new Date(0).toISOString(),
    };
  }

  async listAlerts(filter: AlertFilter): Promise<Alert[]> {
    const nowMs = Date.now();
    await this.redis.zremrangebyscore("tf:alerts:active", 0, nowMs);
    const ids = await this.redis.zrange("tf:alerts:active", 0, -1);
    let alerts: Alert[] = [];
    for (const id of ids) {
      const alert = await this.hydrate(id);
      if (alert) alerts.push(alert);
    }

    if (filter.route) {
      const r = normalizeRoute(filter.route);
      if (r) {
        alerts = alerts.filter(
          (a) => normalizeRoute(a.ghostRoute) === r || normalizeRoute(a.claimedRoute) === r,
        );
      }
    }
    if (filter.stop) {
      const s = filter.stop.trim().toLowerCase();
      alerts = alerts.filter(
        (a) =>
          (a.stop ?? "").toLowerCase().includes(s) || (a.matchedStop ?? "").toLowerCase().includes(s),
      );
    }
    if (filter.lat !== undefined && filter.lng !== undefined) {
      const radius = filter.radiusKm ?? 5;
      alerts = alerts.filter(
        (a) => a.geo && distanceKm(filter.lat as number, filter.lng as number, a.geo.lat, a.geo.lng) <= radius,
      );
    }

    alerts.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return alerts.slice(0, filter.limit ?? 50);
  }

  async getAlert(alertId: string): Promise<Alert | null> {
    return this.hydrate(alertId);
  }

  async confirmAlert(alertId: string): Promise<Alert | null> {
    const key = `tf:alert:${alertId}`;
    const exists = await this.redis.exists(key);
    if (!exists) return null;
    await this.redis.hincrby(key, "confirmations", 1);
    return this.hydrate(alertId);
  }

  async pruneExpired(now = Date.now()): Promise<number> {
    const removed = await this.redis.zremrangebyscore("tf:alerts:active", 0, now);
    return removed;
  }

  async stats(): Promise<Stats> {
    await this.pruneExpired();
    const dayKey = `tf:stats:day:${this.dayPrefix()}`;
    const [reports, mismatches, matches, activeRaw] = await Promise.all([
      this.redis.get(`${dayKey}:reports`),
      this.redis.get(`${dayKey}:mismatches`),
      this.redis.get(`${dayKey}:matches`),
      this.redis.zcard("tf:alerts:active"),
    ]);

    const ghostKeys = (
      await this.redis.keys(`${dayKey}:ghost:*`)
    ).map((k) => k.replace(`${dayKey}:ghost:`, ""));
    const ghostCounts: { route: string; count: number }[] = [];
    for (const route of ghostKeys) {
      const count = await this.redis.get(`${dayKey}:ghost:${route}`);
      ghostCounts.push({ route, count: Number(count ?? 0) });
    }
    ghostCounts.sort((a, b) => b.count - a.count);

    return {
      generatedAt: new Date().toISOString(),
      routesInDataset: 0, // filled by caller
      totalStops: 0,
      activeAlerts: activeRaw,
      reportsLast24h: Number(reports ?? 0),
      mismatchesLast24h: Number(mismatches ?? 0),
      matchesLast24h: Number(matches ?? 0),
      topGhostRoutes: ghostCounts.slice(0, 5),
    };
  }
}

function safeParseArray(raw: string | undefined): string[] | undefined {
  if (!raw) return undefined;
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((x) => typeof x === "string") : undefined;
  } catch {
    return undefined;
  }
}
