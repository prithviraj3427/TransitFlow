import { readFile } from "node:fs/promises";
import path from "node:path";
import type { RouteRecord, RouteSummary } from "../domain/types.js";
import { normalizeRoute, normalizeStop } from "../domain/normalize.js";

/**
 * In-memory index over the route dataset (data/routes.json).
 *
 * Provides:
 *  - exact route lookup (tolerant of case/spacing: "102a" → "102A")
 *  - search across route number, name and stops
 *  - "which routes normally stop here" for stop intelligence
 *  - fuzzy stop matching for commuter-typed locations
 */

interface StopEntry {
  canonical: string;
  /** dataset route numbers that serve this stop */
  routes: Set<string>;
}

export interface StopMatch {
  stop: string;
  expectedRoutes: string[];
  /** 0..1 — higher is more confident */
  score: number;
}

class RoutesIndex {
  private byNumber = new Map<string, RouteRecord>();
  private byStop = new Map<string, StopEntry>();
  private records: RouteRecord[] = [];
  private allStops: string[] = [];
  loaded = false;

  async load(dataPath: string): Promise<void> {
    const raw = await readFile(path.resolve(dataPath), "utf8");
    const data: RouteRecord[] = JSON.parse(raw);

    for (const record of data) {
      if (!record || typeof record.routeNumber !== "string" || !Array.isArray(record.stops)) {
        continue;
      }
      const normalizedNumber = normalizeRoute(record.routeNumber);
      if (!normalizedNumber) continue;
      const clean: RouteRecord = {
        routeNumber: normalizedNumber,
        name: typeof record.name === "string" ? record.name : "",
        stops: record.stops.filter((s): s is string => typeof s === "string" && s.trim() !== ""),
      };
      if (this.byNumber.has(normalizedNumber)) continue;
      this.byNumber.set(normalizedNumber, clean);
      this.records.push(clean);
      for (const stop of clean.stops) {
        const key = normalizeStop(stop);
        if (!key) continue;
        let entry = this.byStop.get(key);
        if (!entry) {
          entry = { canonical: stop.trim(), routes: new Set() };
          this.byStop.set(key, entry);
        }
        entry.routes.add(normalizedNumber);
      }
    }

    this.allStops = [...this.byStop.values()]
      .map((e) => e.canonical)
      .sort((a, b) => a.localeCompare(b));
    this.loaded = true;
  }

  get routeCount(): number {
    return this.records.length;
  }

  get stopCount(): number {
    return this.allStops.length;
  }

  listStops(limit = 600): string[] {
    return this.allStops.slice(0, limit);
  }

  getRoute(routeNumber: string): RouteRecord | null {
    const key = normalizeRoute(routeNumber);
    if (key === null) return null;
    return this.byNumber.get(key) ?? null;
  }

  /**
   * Search routes by number fragment, name, or stop name.
   * Ranking: exact number > number prefix > name match > stop match.
   */
  search(query: string, limit = 12): RouteSummary[] {
    const q = query.trim().toLowerCase();
    if (q === "") {
      return this.records.slice(0, limit).map(summarize);
    }
    const scored: { record: RouteRecord; score: number }[] = [];
    for (const record of this.records) {
      let score = 0;
      const number = record.routeNumber.toLowerCase();
      const name = record.name.toLowerCase();
      if (number === q) score = 100;
      else if (number.startsWith(q)) score = 80;
      else if (number.includes(q)) score = 60;
      else if (name.includes(q)) score = 40;
      else {
        for (const stop of record.stops) {
          if (stop.toLowerCase().includes(q)) {
            score = 20;
            break;
          }
        }
      }
      if (score > 0) scored.push({ record, score });
    }
    scored.sort((a, b) => b.score - a.score || a.record.routeNumber.localeCompare(b.record.routeNumber));
    return scored.slice(0, limit).map((s) => summarize(s.record));
  }

  /** Routes that normally serve the given (fuzzy) stop. */
  expectedRoutesAt(stop: string): StopMatch | null {
    const key = normalizeStop(stop);
    if (!key) return null;
    const exact = this.byStop.get(key);
    if (exact) {
      return {
        stop: exact.canonical,
        expectedRoutes: [...exact.routes].sort(byRoute),
        score: 1,
      };
    }
    // Fuzzy pass: prefix, substring, then token overlap.
    let best: StopMatch | null = null;
    for (const [key2, entry] of this.byStop) {
      let score = 0;
      if (key2.startsWith(key) || key.startsWith(key2)) score = 0.8;
      else if (key2.includes(key) || key.includes(key2)) score = 0.6;
      else {
        const a = new Set(key.split(" ").filter((t) => t.length > 2));
        const b = key2.split(" ").filter((t) => t.length > 2);
        const overlap = b.filter((t) => a.has(t)).length;
        if (a.size > 0) score = 0.3 * (overlap / Math.max(a.size, b.length));
      }
      if (score >= 0.5 && (!best || score > best.score)) {
        best = { stop: entry.canonical, expectedRoutes: [...entry.routes].sort(byRoute), score };
      }
    }
    return best;
  }
}

function summarize(record: RouteRecord): RouteSummary {
  return {
    routeNumber: record.routeNumber,
    name: record.name,
    stopCount: record.stops.length,
    firstStops: record.stops.slice(0, 3),
  };
}

function byRoute(a: string, b: string): number {
  return a.localeCompare(b, undefined, { numeric: true });
}

export const routesIndex = new RoutesIndex();
