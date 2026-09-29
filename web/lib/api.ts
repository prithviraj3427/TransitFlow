import type {
  AlertList,
  ConfirmResponse,
  Meta,
  ReportResponse,
  RouteRecord,
  RouteSummary,
  ScanResult,
  Stats,
} from "./types";

const API_BASE = (process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:4000").replace(/\/$/, "");

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, options);
  } catch {
    throw new ApiError("Can't reach the TransitFlow server right now. Check your connection.", 0);
  }

  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    /* non-JSON */
  }

  if (!res.ok) {
    const message =
      body && typeof body === "object" && "error" in body &&
      (body as { error?: { message?: string } }).error?.message
        ? (body as { error: { message: string } }).error.message
        : `Request failed (${res.status})`;
    throw new ApiError(message, res.status);
  }

  return body as T;
}

// ── Radar ────────────────────────────────────────────────────────────

export function getAlerts(params?: {
  route?: string;
  stop?: string;
  lat?: number;
  lng?: number;
  radiusKm?: number;
}): Promise<AlertList> {
  const qs = new URLSearchParams();
  if (params?.route) qs.set("route", params.route);
  if (params?.stop) qs.set("stop", params.stop);
  if (params?.lat !== undefined) qs.set("lat", String(params.lat));
  if (params?.lng !== undefined) qs.set("lng", String(params.lng));
  if (params?.radiusKm) qs.set("radiusKm", String(params.radiusKm));
  const q = qs.toString();
  return request<AlertList>(`/api/alerts${q ? `?${q}` : ""}`);
}

export function confirmAlert(alertId: string): Promise<ConfirmResponse> {
  return request<ConfirmResponse>(`/api/alerts/${alertId}/confirm`, { method: "POST" });
}

// ── Scan & report ────────────────────────────────────────────────────

export function scanImage(imageBase64: string, mimeType: string): Promise<ScanResult> {
  return request<ScanResult>("/api/scan", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ imageBase64, mimeType }),
  });
}

export function reportFromScan(
  scanId: string,
  payload: { stop?: string; lat?: number; lng?: number; stickerRoute?: string | null; ledRoute?: string | null; note?: string },
): Promise<ReportResponse> {
  return request<ReportResponse>(`/api/scans/${scanId}/report`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export function reportManual(payload: {
  stickerRoute: string;
  ledRoute: string;
  stop?: string;
  lat?: number;
  lng?: number;
  note?: string;
}): Promise<ReportResponse> {
  return request<ReportResponse>("/api/report", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
}

// ── Routes ───────────────────────────────────────────────────────────

export function searchRoutes(q: string, limit = 12): Promise<{ routes: RouteSummary[] }> {
  const encoded = encodeURIComponent(q);
  return request<{ routes: RouteSummary[] }>(`/api/routes?q=${encoded}&limit=${limit}`);
}

export function getRoute(routeNumber: string): Promise<{ route: RouteRecord }> {
  return request<{ route: RouteRecord }>(`/api/routes/${encodeURIComponent(routeNumber)}`);
}

export function getStops(limit = 600): Promise<{ stops: string[] }> {
  return request<{ stops: string[] }>(`/api/stops?limit=${limit}`);
}

// ── System ───────────────────────────────────────────────────────────

export function getStats(): Promise<Stats> {
  return request<Stats>("/api/stats");
}

export function getMeta(): Promise<Meta> {
  return request<Meta>("/api/meta");
}

export function getHealth(): Promise<{ status: string }> {
  return request<{ status: string }>("/api/health");
}
