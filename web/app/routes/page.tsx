"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, MapPin, Search, Star, X } from "lucide-react";
import { getRoute, searchRoutes } from "@/lib/api";
import type { RouteRecord, RouteSummary } from "@/lib/types";
import { CardSkeleton, EmptyState } from "@/components/Primitives";
import { useToast } from "@/components/Toast";

const FAV_KEY = "transitflow:favorite-routes";

export default function RoutesPage() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<RouteSummary[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [detail, setDetail] = useState<RouteRecord | null>(null);
  const [favorites, setFavorites] = useState<string[]>([]);
  const debounceRef = useRef<number | null>(null);
  const { showToast } = useToast();

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(FAV_KEY);
      if (stored) setFavorites(JSON.parse(stored));
    } catch {
      /* ignore */
    }
  }, []);

  function toggleFavorite(routeNumber: string) {
    setFavorites((current) => {
      const next = current.includes(routeNumber)
        ? current.filter((r) => r !== routeNumber)
        : [...current, routeNumber];
      try {
        window.localStorage.setItem(FAV_KEY, JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  }

  async function runSearch(q: string) {
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(async () => {
      setLoading(true);
      setError(null);
      setDetail(null);
      try {
        const res = await searchRoutes(q, 12);
        setResults(res.routes);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Search failed.");
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 220);
  }

  useEffect(() => {
    runSearch(query);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  async function expand(routeNumber: string) {
    if (expanded === routeNumber) {
      setExpanded(null);
      return;
    }
    setExpanded(routeNumber);
    if (detail?.routeNumber === routeNumber) return;
    try {
      const res = await getRoute(routeNumber);
      setDetail(res.route);
    } catch {
      setDetail(null);
    }
  }

  const favoriteResults = useMemo(
    () => (favorites.length > 0 ? favorites.map((r) => ({ number: r })) : []),
    [favorites],
  );

  return (
    <div className="animate-fade-up">
      <div className="mb-4">
        <h1 className="text-[22px] font-black tracking-tight">Routes</h1>
        <p className="mt-0.5 text-[13px] font-semibold text-muted">
          256 CBE city routes · search by number, name or stop.
        </p>
      </div>

      <div className="relative mb-4">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Try “102”, “Gandhipuram” or “Kovandampalayam”"
          className="w-full rounded-2xl border border-line bg-surface py-3 pl-10 pr-10 text-[13.5px] font-semibold placeholder:font-medium placeholder:text-muted focus:border-brand"
        />
        {query && (
          <button
            onClick={() => setQuery("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-muted hover:text-ink"
            aria-label="Clear search"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {favorites.length > 0 && (
        <div className="mb-4">
          <p className="mb-2 text-[10.5px] font-extrabold uppercase tracking-wider text-muted">Your favorites</p>
          <div className="flex flex-wrap gap-2">
            {favoriteResults.map((f) => (
              <button
                key={f.number}
                onClick={() => {
                  setQuery("");
                  expand(f.number);
                }}
                className="flex items-center gap-1.5 rounded-full border border-brand/30 bg-brand-soft px-3.5 py-1.5 text-[12px] font-extrabold text-brand-ink active:scale-95"
              >
                <Star className="h-3 w-3 fill-current" strokeWidth={2} />
                {f.number}
              </button>
            ))}
          </div>
        </div>
      )}

      {loading && !results ? (
        <>
          <CardSkeleton rows={2} />
          <CardSkeleton rows={2} />
          <CardSkeleton rows={2} />
        </>
      ) : error ? (
        <EmptyState title="Search is offline" body={error} />
      ) : results && results.length === 0 ? (
        <EmptyState
          icon={<Search className="h-5 w-5" />}
          title={`Nothing for “${query}”`}
          body="Try a route number like 102A, a place name, or a stop name."
        />
      ) : (
        <ul className="space-y-2.5">
          {results?.map((route) => {
            const open = expanded === route.routeNumber;
            const isFav = favorites.includes(route.routeNumber);
            return (
              <li key={route.routeNumber} className="overflow-hidden rounded-3xl border border-line bg-surface shadow-card">
                <button
                  onClick={() => expand(route.routeNumber)}
                  className="flex w-full items-center gap-3 p-4 text-left"
                >
                  <span
                    className={`flex h-11 w-14 shrink-0 items-center justify-center rounded-xl text-[15px] font-black tracking-tight ${
                      open ? "bg-brand text-white" : "bg-brand-soft text-brand-ink"
                    }`}
                  >
                    {route.routeNumber}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13.5px] font-bold leading-snug">{route.name}</span>
                    <span className="mt-0.5 block text-[11.5px] font-semibold text-muted">
                      {route.stopCount} stops · {route.firstStops.join(" → ")}
                    </span>
                  </span>
                  <span className="flex items-center gap-1">
                    <span
                      role="button"
                      tabIndex={0}
                      aria-label={isFav ? "Remove favorite" : "Add favorite"}
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleFavorite(route.routeNumber);
                        showToast("success", isFav ? `Removed ${route.routeNumber} from favorites.` : `${route.routeNumber} added to favorites.`);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.stopPropagation();
                          toggleFavorite(route.routeNumber);
                        }
                      }}
                      className={`rounded-full p-1.5 ${isFav ? "text-warn" : "text-muted hover:text-ink"}`}
                    >
                      <Star className={`h-4 w-4 ${isFav ? "fill-current" : ""}`} strokeWidth={2} />
                    </span>
                    <ChevronDown className={`h-4 w-4 text-muted transition-transform ${open ? "rotate-180" : ""}`} />
                  </span>
                </button>

                {open && (
                  <div className="border-t border-line/70 bg-surface-2/40 p-4 animate-fade-up">
                    {detail && detail.routeNumber === route.routeNumber ? (
                      <ol className="space-y-0">
                        {detail.stops.map((stopName, i) => (
                          <li key={`${stopName}-${i}`} className="relative flex gap-3 pb-3 last:pb-0">
                            {i < detail.stops.length - 1 && (
                              <span className="absolute left-[7px] top-4 h-full w-px bg-line" aria-hidden />
                            )}
                            <span
                              className={`relative z-10 mt-1 h-[15px] w-[15px] shrink-0 rounded-full border-2 ${
                                i === 0
                                  ? "border-brand bg-brand-soft"
                                  : i === detail.stops.length - 1
                                    ? "border-brand bg-brand"
                                    : "border-line bg-surface"
                              }`}
                            />
                            <span className="text-[12.5px] font-semibold leading-snug">
                              {i === 0 && <span className="mr-1.5 text-[10px] font-extrabold uppercase tracking-wider text-brand-ink">Start</span>}
                              {i === detail.stops.length - 1 && (
                                <span className="mr-1.5 text-[10px] font-extrabold uppercase tracking-wider text-brand-ink">End</span>
                              )}
                              {stopName}
                            </span>
                          </li>
                        ))}
                      </ol>
                    ) : (
                      <p className="flex items-center gap-2 text-[12.5px] font-semibold text-muted">
                        <MapPin className="h-4 w-4" /> Loading full stop list…
                      </p>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
