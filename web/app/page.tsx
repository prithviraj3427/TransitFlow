"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  Camera,
  Check,
  CheckCircle2,
  LocateFixed,
  RefreshCw,
  Search,
  ShieldCheck,
} from "lucide-react";
import { confirmAlert, getAlerts, getStats } from "@/lib/api";
import type { Alert, Stats } from "@/lib/types";
import { relativeTime } from "@/lib/format";
import { Badge, CardSkeleton, EmptyState } from "@/components/Primitives";
import { useToast } from "@/components/Toast";

const REFRESH_MS = 25_000;

export default function RadarPage() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nearMe, setNearMe] = useState(false);
  const [geo, setGeo] = useState<{ lat: number; lng: number } | null>(null);
  const [routeFilter, setRouteFilter] = useState("");
  const [confirmed, setConfirmed] = useState<Record<string, number>>({});
  const { showToast } = useToast();
  const geoTried = useRef(false);

  const load = useCallback(async (initial = false) => {
    if (initial) setLoading(true);
    else setRefreshing(true);
    setError(null);
    try {
      const [alertData, statsData] = await Promise.all([
        getAlerts({
          ...(nearMe && geo ? { lat: geo.lat, lng: geo.lng, radiusKm: 5 } : {}),
          ...(routeFilter ? { route: routeFilter } : {}),
        }),
        getStats(),
      ]);
      setAlerts(alertData.alerts);
      setStats(statsData);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't load the radar feed.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [nearMe, geo, routeFilter]);

  useEffect(() => {
    load(true);
    const timer = window.setInterval(() => load(false), REFRESH_MS);
    return () => window.clearInterval(timer);
  }, [load]);

  function toggleNearMe() {
    if (nearMe) {
      setNearMe(false);
      return;
    }
    if (!navigator.geolocation) {
      showToast("error", "Location isn't available on this browser.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGeo({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setNearMe(true);
        showToast("success", "Showing alerts within 5 km of you.");
      },
      () => showToast("error", "Couldn't get your location."),
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 60_000 },
    );
  }

  async function handleConfirm(alert: Alert) {
    if (confirmed[alert.alertId] !== undefined) return;
    try {
      const res = await confirmAlert(alert.alertId);
      setConfirmed((current) => ({ ...current, [alert.alertId]: res.confirmations }));
      setAlerts((current) =>
        current.map((a) => (a.alertId === alert.alertId ? { ...a, confirmations: res.confirmations } : a)),
      );
    } catch (err) {
      showToast("error", err instanceof Error ? err.message : "Couldn't confirm that alert.");
    }
  }

  const ghostRate = useMemo(() => {
    if (!stats || stats.reportsLast24h === 0) return null;
    return Math.round((stats.mismatchesLast24h / stats.reportsLast24h) * 100);
  }, [stats]);

  const now = Date.now();

  return (
    <div className="animate-fade-up">
      {/* Header */}
      <div className="mb-4">
        <h1 className="text-[22px] font-black tracking-tight">Ghost-Bus Radar</h1>
        <p className="mt-0.5 text-[13px] font-semibold text-muted">
          Live route-mismatch reports from scouts near you.
        </p>
      </div>

      {/* Stats strip */}
      {stats && (
        <div className="mb-4 grid grid-cols-3 gap-2">
          <StatTile label="Live alerts" value={String(stats.activeAlerts)} tone={stats.activeAlerts > 0 ? "bad" : "good"} />
          <StatTile label="Verified 24h" value={String(stats.matchesLast24h)} tone="good" />
          <StatTile label="Ghost rate" value={ghostRate !== null ? `${ghostRate}%` : "—"} tone={ghostRate !== null && ghostRate > 25 ? "warn" : "brand"} />
        </div>
      )}

      {/* Filters */}
      <div className="mb-4 flex gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <input
            value={routeFilter}
            onChange={(e) => setRouteFilter(e.target.value)}
            placeholder="Filter by route, e.g. 102A"
            className="w-full rounded-2xl border border-line bg-surface py-2.5 pl-9 pr-3 text-[13px] font-semibold placeholder:font-medium placeholder:text-muted focus:border-brand"
          />
        </div>
        <button
          onClick={toggleNearMe}
          aria-pressed={nearMe}
          className={`flex items-center gap-1.5 rounded-2xl border px-3.5 text-[12px] font-bold transition-colors ${
            nearMe ? "border-brand bg-brand-soft text-brand-ink" : "border-line bg-surface text-muted hover:text-ink"
          }`}
        >
          {nearMe ? <Check className="h-3.5 w-3.5" /> : <LocateFixed className="h-3.5 w-3.5" />}
          Near me
        </button>
        <button
          onClick={() => load(false)}
          aria-label="Refresh"
          className="flex h-10 w-10 items-center justify-center rounded-2xl border border-line bg-surface text-muted hover:text-ink"
        >
          <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
        </button>
      </div>

      {/* Feed */}
      {loading ? (
        <>
          <CardSkeleton rows={4} />
          <CardSkeleton rows={3} />
        </>
      ) : error ? (
        <EmptyState
          icon={<AlertTriangle className="h-6 w-6" />}
          title="Radar is offline"
          body={error}
          action={
            <button
              onClick={() => load(true)}
              className="rounded-xl bg-brand px-5 py-2.5 text-[13px] font-bold text-white active:scale-95"
            >
              Try again
            </button>
          }
        />
      ) : alerts.length === 0 ? (
        <EmptyState
          icon={<ShieldCheck className="h-6 w-6" />}
          title={nearMe || routeFilter ? "No alerts match your filters" : "All clear right now"}
          body={
            nearMe || routeFilter
              ? "Try widening your filters — or be the first scout to report a mismatch."
              : "No route mismatches reported recently. Spotted a bus running the wrong route? Scan it."
          }
          action={
            <Link
              href="/scan"
              className="flex items-center gap-2 rounded-xl bg-brand px-5 py-2.5 text-[13px] font-bold text-white active:scale-95"
            >
              <Camera className="h-4 w-4" /> Scan a bus
            </Link>
          }
        />
      ) : (
        <ul className="space-y-3">
          {alerts.map((alert) => (
            <RadarCard
              key={alert.alertId}
              alert={alert}
              fresh={now - Date.parse(alert.createdAt) < 2 * 60_000}
              confirmations={confirmed[alert.alertId] ?? alert.confirmations}
              confirming={false}
              onConfirm={() => handleConfirm(alert)}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function StatTile({ label, value, tone }: { label: string; value: string; tone: "good" | "bad" | "warn" | "brand" }) {
  const tones: Record<string, string> = {
    good: "text-good-ink",
    bad: "text-bad-ink",
    warn: "text-warn-ink",
    brand: "text-brand-ink",
  };
  return (
    <div className="rounded-2xl border border-line bg-surface px-3 py-2.5">
      <div className={`text-lg font-black leading-tight tracking-tight ${tones[tone]}`}>{value}</div>
      <div className="mt-0.5 text-[10px] font-bold uppercase tracking-wider text-muted">{label}</div>
    </div>
  );
}

function RadarCard({
  alert,
  fresh,
  confirmations,
  confirming,
  onConfirm,
}: {
  alert: Alert;
  fresh: boolean;
  confirmations: number;
  confirming: boolean;
  onConfirm: () => void;
}) {
  return (
    <li className="relative overflow-hidden rounded-3xl border border-bad/40 bg-surface p-4 shadow-card animate-fade-up">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-[28px] font-black leading-none tracking-tight">{alert.ghostRoute}</span>
            {fresh && (
              <span className="relative flex h-2 w-2">
                <span className="absolute h-2 w-2 rounded-full bg-bad animate-pulse-ring" />
                <span className="relative h-2 w-2 rounded-full bg-bad" />
              </span>
            )}
          </div>
          <p className="mt-1 truncate text-[12.5px] font-semibold text-muted">
            {alert.matchedStop ?? alert.stop ?? "Location not set"}
          </p>
        </div>
        <Badge tone="bad">
          <AlertTriangle className="h-3 w-3" strokeWidth={3} /> Mismatch
        </Badge>
      </div>

      <div className="mb-3 flex items-center gap-2 rounded-2xl bg-bad-soft px-3 py-2.5">
        <span className="text-[12px] font-bold text-bad-ink">
          Claims {alert.claimedRoute ?? "?"}
        </span>
        <span className="h-4 w-px bg-current opacity-30" />
        <span className="text-[12px] font-bold text-bad-ink">Running {alert.ghostRoute}</span>
      </div>

      {alert.expectedRoutesAtStop && alert.expectedRoutesAtStop.length > 0 && (
        <p className="mb-3 text-[11.5px] font-medium leading-relaxed text-muted">
          Normal routes at this stop:{" "}
          <span className="font-bold text-ink">{alert.expectedRoutesAtStop.slice(0, 4).join(" · ")}</span>
        </p>
      )}

      <div className="flex items-center justify-between">
        <span className="text-[11.5px] font-semibold text-muted">{relativeTime(alert.createdAt)}</span>
        <button
          onClick={onConfirm}
          disabled={confirming}
          className={`flex items-center gap-1.5 rounded-xl px-3 py-2 text-[12px] font-bold transition-all active:scale-95 ${
            confirmations > 0 ? "bg-good-soft text-good-ink" : "border border-line bg-surface text-muted hover:text-ink"
          }`}
        >
          <CheckCircle2 className="h-3.5 w-3.5" strokeWidth={2.5} />
          {confirmations > 0 ? `Confirmed ×${confirmations}` : "I saw it too"}
        </button>
      </div>
    </li>
  );
}
