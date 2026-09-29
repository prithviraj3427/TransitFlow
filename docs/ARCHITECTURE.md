# Architecture

TransitFlow is a small three-tier system with one deliberately important rule:

> **The server is the single source of truth for the verdict.**
> Clients capture data and show results — they never decide whether a bus is a ghost.

```
┌───────────────┐  ┌───────────────┐
│  Web (Next.js)│  │  Android      │
│  Vercel / dev │  │  Compose      │
└──────┬────────┘  └──────┬────────┘
       │  HTTPS (JSON)    │
       └─────────┬─────────┘
                 ▼
        ┌─────────────────┐   ┌────────────────────────────┐
        │  Core API       │   │  Gemini Vision (REST)      │
        │  Express + TS   │──▶│  sticker vs LED extraction │
        │                 │   └────────────────────────────┘
        │  · domain/       │
        │  · store/        │◀── in-memory (default) or Redis
        │  · data/         │◀── data/routes.json (256 CBE routes)
        └─────────────────┘
```

## Components

### Part A — Core API (`server/`)

| Module | Responsibility |
| --- | --- |
| `src/app.ts` | Express wiring: CORS allow-list, JSON body limit (12 MB), routes, error handler |
| `src/config.ts` | Env-driven config (port, Gemini, Redis, CORS, TTL, rate limits) |
| `src/ai/gemini.ts` | Dependency-free Gemini `generateContent` client with **native structured output** (`responseSchema`), 1 retry on 429/5xx, 12 s timeout, friendly errors |
| `src/domain/decision.ts` | `decide(sticker, led)` → `MATCH \| MISMATCH \| UNCERTAIN` after normalization |
| `src/domain/normalize.ts` | Case/space/dot tolerant route comparison (`102a` ≡ `102A`, `36 H` ≡ `36H`) |
| `src/data/routesIndex.ts` | Loads `data/routes.json`; powers route search + fuzzy stop matching ("routes normally expected here") |
| `src/routes/scan.ts` | `POST /api/scan` — validates image (mime sniff, size), calls Gemini, stores the scan, returns `scanId + verdict + extraction` |
| `src/routes/report.ts` | `POST /api/scans/:id/report` + `POST /api/report` — the **report pipeline**: resolve readings → compute verdict → match stop → persist → publish alert on MISMATCH |
| `src/routes/alerts.ts` | `GET /api/alerts` (route/stop/geo filters), `POST /api/alerts/:id/confirm` |
| `src/routes/routesApi.ts` | `GET /api/routes`, `GET /api/routes/:n`, `GET /api/stops` |
| `src/routes/system.ts` | `/api/health`, `/api/meta`, `/api/stats` |
| `src/store/*` | `Store` interface + `memory.ts` / `redis.ts` implementations (scans, reports, alerts, confirmations) |
| `src/http/rateLimit.ts` | Token-bucket rate limiter (per IP, per route key) |

### Part B — Clients (`web/`, `android/`)

- **Web** — Next.js 14 App Router + Tailwind. Pages: Radar (`/`), Scan (`/scan`), Routes (`/routes`), Profile, About. Camera via `getUserMedia` with gallery + manual fallbacks.
- **Android** — Kotlin, Jetpack Compose, CameraX (`PreviewView` + `ImageCapture`). Same four screens: Radar, Scan (live camera / gallery picker / manual entry), Routes (search + stop timelines + favorites), Profile (name, theme, favorites, server URL).
- Both apps share the same behavioral contract: **show what the server says**, never compute a verdict locally, and always surface the API's error messages.

## The report pipeline (core business logic)

```
client ──photo──▶ POST /api/scan
                    │  validate (mime sniff, ≤10 MB)
                    ▼
              Gemini Vision ──▶ { stickerRoute, ledRoute, confidence, note }
                    │  decide(sticker, led)
                    ▼
              store scan (TTL 30 min) ──▶ return { scanId, verdict, extraction }

client ──(optional edits + stop + geo)──▶ POST /api/scans/:scanId/report
                    │  readings = body overrides ?? scan readings
                    │  verdict  = decide(readings)          ← server-side, always
                    │  stop     = fuzzy-match vs dataset    ← "routes normally here"
                    ▼
              store report
              verdict == MISMATCH ──▶ publish Alert {
                                          ghostRoute: led,
                                          claimedRoute: sticker,
                                          stop/matchedStop/expectedRoutes,
                                          geo, ttl: 30 min }
                    │
                    ▼
              GET /api/alerts (radar) ◀── every client, filtered by route/stop/geo
              POST /api/alerts/:id/confirm ("I saw it too")
```

**Verdict rules** (`domain/decision.ts`):

| sticker | led | verdict |
| --- | --- | --- |
| both present, normalize equal | | `MATCH` |
| both present, different | | `MISMATCH` → alert (ghost route = LED) |
| either missing | | `UNCERTAIN` → report rejected with guidance (400) |

## Data & state

- **`data/routes.json`** — 256 CBE routes: `{ routeNumber, name, stops[] }`, 284 unique stops. Loaded once at boot; powers search, stop autocomplete, and the "expected routes at stop" context signal.
- **Scans** — kept server-side for 30 min so a report can reference its AI reading (prevents tampering with the readings after the fact).
- **Reports** — immutable audit trail: who reported, what was read, where, verdict.
- **Alerts** — derived from MISMATCH reports; carry TTL (`expiresAt`), confirmation counts; expired alerts are pruned on read.
- **Storage** — in-memory by default (buildathon-friendly, zero setup). Set `REDIS_URL` for durability; both implementations satisfy the same `Store` interface.

## Security & abuse controls

- **CORS allow-list** — localhost + `*.vercel.app`/`*.netlify.app` by default; explicit `CORS_ORIGINS` in prod. Non-browser clients (Android, curl) send no `Origin` and pass.
- **Token-bucket rate limits** per IP: scans 10/15 min, reports 30/15 min, confirms 60/hour.
- **Image validation** — mime allow-list + base64 magic-byte sniff + 10 MB cap.
- **Server-side verdict** — a malicious client cannot fabricate "verified" or "ghost" outcomes; the readings are re-checked and the stop re-matched.
- **No PII** — location is optional, coarse (GPS point) and only ever used for proximity ordering; photos are analyzed once and discarded.

## Failure modes & degradation

| Failure | Behavior |
| --- | --- |
| No `GEMINI_API_KEY` | `POST /api/scan` → 503 with "use manual entry"; everything else works |
| Gemini 429/timeout | one automatic retry; then a friendly 502-ish message |
| Server down | clients show offline states; manual entry still queues nothing (by design — honest) |
| Bad photo (no bus) | extraction returns nulls → `UNCERTAIN` → user edits or retakes |
| Alert expired | confirm returns 404; radar list skips expired entries |

## Scaling notes (intentionally small)

The API is stateless except for the `Store` — run it anywhere Node runs. For a buildathon, one instance + in-memory is the sweet spot; the Redis swap is a single env var. Clients are fully static (web) or on-device (Android), so horizontal scaling means scaling the API only.
