# Unified Dashboard — agent guide

A Next.js (App Router) kiosk dashboard running on a Raspberry Pi 5 in landscape
(1280×800, port 3100). It aggregates social/revenue/web metrics plus a rain
forecast and overhead flights into one always-on screen.

> ⚠️ **THIS REPO IS PUBLIC** (github.com/BenAttanasio/Unified-Dashboard).
> NEVER commit secrets, API keys, tokens, or PII. All secrets live ONLY in `.env`
> (gitignored); `.env.example` documents the keys with EMPTY values. PII is
> abstracted behind env vars (site name → `NEXT_PUBLIC_SITE_NAME`, monitored
> service → `MONITOR_SERVICE`/`_LABEL`, home coords → `HOME_LAT`/`HOME_LON`).
> Before any commit, verify no token/key/coordinate/handle landed in tracked files
> (`git diff --staged`). `.env` and `RASPBERRY_PI_REFERENCE.md` are git-ignored —
> keep it that way.

## Architecture (read this before adding a source)

```
scheduler (instrumentation.ts → startScheduler)   ← the ONLY place that calls external APIs
   │  per-source tick, gated by INTERVALS + backoff
   ├─ numeric sources → cache.ts (in-memory) + SQLite snapshots (db.ts)
   └─ rich sources   → live-store.ts (in-memory only)
        │
   API routes (src/app/api/*) READ cache/live-store — they never fetch
        │
   SWR hooks (src/hooks/use-*.ts)  →  section components (src/components/dashboard/*-section.tsx)
        │
   page.tsx places sections on the CSS grid (src/app/globals.css grid-template-areas + .area-*)
```

Key invariant: **only the scheduler makes external calls.** Routes are pure reads.
Both `cache.ts` and `live-store.ts` are backed by `globalThis` so the scheduler
bundle and the route bundle share one instance.

## Logging — REQUIRED for every source

Every fetch must land in the live activity log via `logFetch(platform, status, errorMessage?, summary?)`
(`src/lib/db.ts`), so it shows in the system-bar drawer like everything else.

- Numeric sources get this for free through the scheduler's `ok()` / `fail()` helpers
  (`ok()` also writes `insertSnapshots` + a human summary from `src/lib/log-summary.ts`).
- Rich sources call `logFetch` directly in their tick. Provide a one-line `summarize()`
  in the service so the log reads like `weather ok — Rain likely ~3pm · 71°F`.
- **Exception:** high-frequency sources should log on CHANGE, not every poll, to keep the
  log readable. `flights` polls every 25s but only logs when the shown aircraft changes
  (and always on error) — see `tickFlights` in `src/services/scheduler.ts`.

## Adding a NUMERIC source (followers, revenue, counts)

1. `src/services/platforms/<name>.ts` exporting `isConfigured()` + `fetch<Name>(): Promise<MetricValues>`
   (throw on failure; never log inside the service — the scheduler classifies + logs).
2. Add a `tick<Name>()` in `scheduler.ts` (`if (!isConfigured()) return cache.setNotConfigured(key)`,
   `if (!due(key, INTERVALS.<name>)) return`, then `ok()/fail()`), call it in `masterTick()`.
3. Add the interval to `INTERVALS` (`src/lib/constants.ts`) and a `summarize` case in `log-summary.ts`.
4. Surface it in `src/app/api/metrics/route.ts` (+ a type in `src/lib/types.ts`), then a section.

## Adding a RICH source (a timeline/object, e.g. weather, flights)

The numeric cache only holds `Record<string, number>`, so payloads that are arrays/objects
use `src/lib/live-store.ts` instead (same `{ status, fetchedAt, data }` convention).

1. Service returns a typed object + a `summarize(data)` helper. Free/keyless examples:
   - `weather.ts` → Open-Meteo rain forecast (no key).
   - `flights.ts` → adsb.fi positions + adsbdb.com routes (no key).
2. Tick writes `live.setOk(key, data)` / `live.setError(key, msg)` and calls `logFetch`.
   To honor the `due()`/backoff cadence, also write a `cache.setOk(key, { ok: 1 })` heartbeat
   (see `tickWeather`) — or run on a dedicated interval (see the `flights` 25s loop).
3. A dedicated route (`src/app/api/<name>/route.ts`) returns `{ status, fetchedAt, ...data }`.
4. A `use<Name>()` SWR hook + a section component.

## Conventions

- Status convention: `FetchStatus = "ok" | "error" | "rate_limited" | "not_configured"` + `fetchedAt` (epoch ms).
- Formatting helpers live in `src/lib/format.ts` (`full`, `currency`, `compact`, `isStale`, …). Reuse them.
- Charts: `MetricChart` (fetches history via `useHistory`) or `Sparkline` directly. Daily series are
  persisted with `recordDailySnapshot` (see `tickVercel`/`tickSite`); read with `getHistory`.
- Secrets live ONLY in `.env` (gitignored). Never commit tokens — the repo is PUBLIC (see the warning up top); `.env.example` documents the keys with empty values.
- Color semantics (intuitive-first): headline numbers are neutral white and turn **red only when the metric is down over the period it charts** (`numberColor`/`trendDirection` in `format.ts`); sparklines are green up / red down / muted flat (`trendColor`). Coral (`--primary`) is NOT used for metric values — it would read as "bad". Section header = green `.section-title` (+ optional grey `.section-caption` inline); metric label = green `.chart-label`/`.tile-label`; a metric's one-line explanation = grey `.chart-hint` directly under its value. Keep this grammar consistent in new sections.
- The header clock shows Central time (`America/Chicago`, labeled CT) + CET (`Europe/Paris`); both
  use explicit IANA zones so DST is automatic.

## Build & deploy

- Local: `npm run dev` (port 3100) → http://localhost:3100. `npm run build` must be clean.
- Deploy to the Pi: **`./deploy.ps1 -Fast`** (build → tar → scp → restart systemd → refresh kiosk).
  Drop `-Fast` to also rebuild the `better-sqlite3` native addon (only needed if Node changed).
- Always run the build and deploy after a change so the user sees it live on the kiosk.
