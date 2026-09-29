# TransitFlow API

Base URL (local): `http://localhost:4000` — every route lives under `/api`.

All requests/responses are JSON. Errors use one shape everywhere:

```json
{ "error": { "message": "Human-readable, safe to show to the user." } }
```

| Status | Meaning |
| --- | --- |
| `400` | Bad request (missing image, unreadable routes, …) — `message` is user-facing |
| `404` | Scan/alert not found or expired |
| `429` | Rate limit hit — wait and retry |
| `503` | AI not configured on this server (`GEMINI_API_KEY` missing) |
| `5xx` | Upstream (Gemini) or storage failure — retry once |

Rate limits (per IP, token bucket): **scan 10 / 15 min** · **report 30 / 15 min** · **confirm 60 / hour**.

---

## Radar

### `GET /api/alerts`

Live ghost-bus alerts (MISMATCH reports within their TTL).

| Query | Type | Notes |
| --- | --- | --- |
| `route` | string | Match `ghostRoute` or `claimedRoute` (normalized) |
| `stop` | string | Fuzzy stop name match |
| `lat`, `lng` | float | With `radiusKm` → geo-filter + distance ordering |
| `radiusKm` | float | Clamped to 0.5–50 |
| `limit` | int | 1–50, default 50 |

```json
{
  "alerts": [
    {
      "alertId": "al_8f2c1d",
      "reportId": "rp_91aa30",
      "ghostRoute": "102A",
      "claimedRoute": "102",
      "stop": "Gandhipuram",
      "matchedStop": "Gandhipuram",
      "expectedRoutesAtStop": ["102", "103", "205"],
      "geo": { "lat": 11.011, "lng": 76.956 },
      "confirmations": 3,
      "createdAt": "2025-01-10T09:14:02.113Z",
      "expiresAt": "2025-01-10T09:44:02.113Z"
    }
  ],
  "count": 1,
  "generatedAt": "2025-01-10T09:14:05.001Z"
}
```

### `POST /api/alerts/:alertId/confirm`

"I saw it too." Body: `{}` (or omit).

```json
{ "alertId": "al_8f2c1d", "confirmations": 4 }
```

`404` when the alert expired or is unknown.

---

## Scan & report

### `POST /api/scan`

Run AI extraction on a bus photo and store the reading server-side.

```json
{ "imageBase64": "/9j/4AAQSkZJRg…", "mimeType": "image/jpeg" }
```

- `imageBase64` — raw base64 (no `data:` prefix). JPEG/PNG/WebP, ≤ 10 MB.
- Magic-byte sniffing rejects non-images with a 400.

```json
{
  "scanId": "sc_7d21b4",
  "verdict": "MISMATCH",
  "extraction": {
    "stickerRoute": "102",
    "ledRoute": "102A",
    "confidence": "HIGH",
    "note": "Red sticker 102 on windshield; LED shows 102A."
  },
  "createdAt": "2025-01-10T09:12:41.902Z"
}
```

`verdict` here is informational — the **report** step re-computes it after any client edits. Scans expire after 30 min.

### `POST /api/scans/:scanId/report`

Confirm a scan with optional corrections + location.

### `POST /api/report`

Fully manual report (no photo).

Both accept the same body (all fields optional, but at least both routes are required to get a verdict):

```json
{
  "stickerRoute": "102",
  "ledRoute": "102A",
  "stop": "Gandhipuram",
  "lat": 11.011,
  "lng": 76.956,
  "note": "Third bus today doing this"
}
```

- Provided `stickerRoute`/`ledRoute` **override** the AI readings (manual entry on the same endpoint).
- `stop` is fuzzy-matched against the dataset; `lat/lng` must be a finite, in-range pair.
- `400` when the final verdict would be `UNCERTAIN` — the message tells the user what's missing.
- `404` for an expired/unknown `scanId`.

`201` response:

```json
{
  "reportId": "rp_91aa30",
  "verdict": "MISMATCH",
  "alert": {
    "alertId": "al_8f2c1d",
    "ghostRoute": "102A",
    "claimedRoute": "102",
    "expiresAt": "2025-01-10T09:44:02.113Z",
    "confirmations": 0
  },
  "matchedStop": "Gandhipuram",
  "expectedRoutesAtStop": ["102", "103", "205"],
  "createdAt": "2025-01-10T09:14:02.113Z"
}
```

For `MATCH`, `alert` is `null`. `alert.expiresAt` is `createdAt + ALERT_TTL_MINUTES` (default 30).

---

## Routes dataset

### `GET /api/routes?q=&limit=`

Search by route number, name, or stop. `q` may be empty (returns first `limit`). `limit` 1–30, default 12.

```json
{
  "routes": [
    { "routeNumber": "1", "name": "Aavarampalayam - Maruthamalai", "stopCount": 28, "firstStops": ["Aavarampalayam", "Ramakrishna Hospital"] }
  ]
}
```

### `GET /api/routes/:routeNumber`

Exact route (case/space tolerant, e.g. `102a` ≡ `102A`).

```json
{ "route": { "routeNumber": "102A", "name": "…", "stops": ["Stop A", "Stop B", "…"] } }
```

`404` with a helpful message when the route isn't in the dataset.

### `GET /api/stops?limit=`

Sorted stop names for autocomplete. `limit` default 600, max 1200.

```json
{ "stops": ["Aavarampalayam", "Gandhipuram", "…"] }
```

---

## System

### `GET /api/health`

```json
{ "status": "ok", "service": "transitflow", "time": "2025-01-10T09:14:05.001Z" }
```

### `GET /api/meta`

```json
{
  "name": "TransitFlow",
  "version": "1.0.0",
  "model": "gemini-2.5-flash",
  "storage": "memory",
  "aiEnabled": true,
  "routesInDataset": 256,
  "totalStops": 284,
  "alertTtlMinutes": 30
}
```

### `GET /api/stats`

```json
{
  "generatedAt": "2025-01-10T09:14:05.001Z",
  "routesInDataset": 256,
  "totalStops": 284,
  "activeAlerts": 1,
  "reportsLast24h": 42,
  "mismatchesLast24h": 9,
  "matchesLast24h": 33,
  "topGhostRoutes": [ { "route": "102A", "count": 4 } ]
}
```

---

## Verdict semantics

| Verdict | Meaning | Side effects |
| --- | --- | --- |
| `MATCH` | sticker ≡ LED (after normalization) | report stored, no alert |
| `MISMATCH` | sticker ≠ LED | report stored **+ radar alert** (TTL 30 min) |
| `UNCERTAIN` | one/both readings missing | report rejected (400) with guidance |

Normalization (`domain/normalize.ts`): case-insensitive, trims, collapses spaces, drops dots — so `102a`, `102 A` and `102A` are the same route.
