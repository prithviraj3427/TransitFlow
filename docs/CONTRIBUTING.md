# Contributing

TransitFlow is built by two people who each own **one equal half** of the system.
The split follows a hard boundary: **Part A owns the API contract; Part B owns everything on the client side of that contract.** Neither half can break the other without changing the contract — and contract changes are always a joint decision.

```
                    ┌───────────────────────────────┐
                    │        SHARED (both)          │
                    │  data/routes.json · contract  │
                    └───────────────────────────────┘
               ┌──────────────────────────────────────────┐
               │                                          │
   ┌───────────┴────────────┐              ┌──────────────┴────────────┐
   │      PART A            │   REST API   │          PART B           │
   │  Core API (server/)    │◀────────────▶│  Clients (web/ + android/)│
   │  + data + scripts      │  JSON only   │  all screens, camera, UX  │
   └────────────────────────┘              └───────────────────────────┘
```

## Part A — Core API (owner: one teammate)

**Owns:**
- `server/` — Express app, Gemini integration, verdict engine, stores, rate limits
- `data/routes.json` + `scripts/scraper.py` — the route dataset and how it's refreshed
- `server/.env.example`, the API contract itself (endpoints, shapes, status codes)
- Deployment of the API (Render), Redis/Upstash wiring
- `docs/API.md`, `docs/ARCHITECTURE.md`

**Guarantees to Part B:**
- The REST contract in [`docs/API.md`](API.md) stays stable; changes are additive first.
- Sensible defaults: in-memory storage works with zero env vars; AI degrades gracefully when no key is set.
- Rate limits and CORS are tuned so the web + Android dev loop never gets stuck.

**Typical tasks:** swap the AI model, add Redis persistence, add a `GET /api/alerts/:id`,
improve stop fuzzy-matching, add a `POST /api/routes` import, tighten rate limits,
write API tests, refresh the dataset.

## Part B — Client apps (owner: other teammate)

**Owns:**
- `web/` — Next.js 14 app (Radar, Scan, Routes, Profile, About)
- `android/` — Compose + CameraX app (Radar, Scan, Routes, Profile)
- Theming (light/dark), icons, copy/UX, toasts/snackbars, empty & error states
- Deployment of the web app (Vercel) and the APK (Android Studio / Play)
- `android/README.md`, web env (`web/.env.local`)

**Guarantees to Part A:**
- Never sends a client-computed verdict — the server decides MATCH/MISMATCH/UNCERTAIN.
- Handles every documented error shape (`{ "error": { "message" } }`, 429s, offline) without crashing.
- Works with the default local API base out of the box (web: `localhost:4000`, Android emulator: `10.0.2.2:4000`).

**Typical tasks:** camera capture UX, route timeline UI, radar refresh cadence, dark mode
polish, share-sheet text, accessibility, app icons, Lighthouse performance, release builds.

## Working together — the rules

1. **The contract is the interface.** `docs/API.md` + `server/src/domain/types.ts` are the
   single source of truth. If you need a field the API doesn't send, open it — don't guess.
2. **Additive changes are cheap; breaking ones are joint.** Renaming a field or changing a
   status code requires both owners to sign off (two reviewers on that PR).
3. **Small, frequent PRs.** Each PR changes one part (A or B) unless it's a contract change.
   Both reviewers can merge either part — ownership ≠ exclusive review rights.
4. **Run the neighbor's smoke test before pushing.**
   - Part A: `npm run typecheck` in `server/`, and hit `/api/health` + `/api/stats` after changes.
   - Part B: `npm run build` in `web/`, and `./gradlew :app:assembleDebug` for Android.
5. **Commits:** imperative subject, ≤ 72 chars. Prefix with the part when useful:
   `api: raise scan rate limit`, `web: radar auto-refresh`, `android: camera fallback`.
6. **No secrets in the repo.** Keys live in `.env` (server) / `.env.local` (web) /
   Android Profile screen or gradle property — all covered by `.gitignore`.

## Local development loop

```bash
# Terminal 1 — API
cd server && npm run dev            # http://localhost:4000

# Terminal 2 — web (hot reload)
cd web && npm run dev               # http://localhost:3000

# Android — Android Studio ▶ Run, or:
cd android && ./gradlew :app:assembleDebug
#   → emulator app talks to http://10.0.2.2:4000 by default
```

Fast feedback trick: point the **web** app at the API with
`NEXT_PUBLIC_API_BASE` and the **Android** app via *Profile → Server URL* —
no rebuilds, both clients can be debugged against the same live API.

## Definition of done (any feature)

- [ ] Works in **web** *and* **Android** (or explicitly N/A for one platform, said in the PR).
- [ ] Server-side verdict unchanged — clients never compute the outcome.
- [ ] Error/empty/loading states handled, not just the happy path.
- [ ] Typechecks/builds pass (`tsc`, `next build`, `assembleDebug`).
- [ ] Docs updated when the contract or env changes.

## Ideas backlog (good first features)

- Push notifications when an alert appears near a favorite stop (Part B + A adds a `GET /api/alerts?since=`).
- "Ghost bus leaderboard" page from `stats.topGhostRoutes` (Part B, data already in Part A).
- Multi-city datasets (Part A: `data/` + loader; Part B: city picker).
- Night-mode LED screenshots (Part A: prompt tweak; Part B: flash-off capture hint).
