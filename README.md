# Unified Dashboard

A single "at a glance" business-health dashboard: social follower counts and
growth, subscription revenue, website traffic, and host system stats — on one
dark, kiosk-friendly screen. Built with Next.js; runs anywhere Node runs
(designed first for a Raspberry Pi kiosk, portable to serverless hosts).

```
┌───────────────────────────────────────────────────────────────┐
│  BUSINESS DASHBOARD                              Sun  12:34 PM  │
├───────────────────┬───────────────────────┬───────────────────┤
│  REVENUE          │  AUDIENCE   Apify $X/$Y│  WEBSITE          │
│  MRR  $X,XXX ↑12% │  YouTube   12.4K  +120 │  Views (7d)  4.2K │
│  30d  $XX,XXX ↑8% │  Instagram  8.2K  +340 │  Visitors    1.9K │
│  Customers   234  │  TikTok    15.1K  +890 │                   │
│  Conversions  18  │  X/Twitter  2.1K   +45 │                   │
├───────────────────┴───────────────────────┴───────────────────┤
│  CPU 0.4 · 52°C · RAM 34% · Disk 18% · <svc> ● · up 12d        │
└───────────────────────────────────────────────────────────────┘
```

## What it shows

- **Revenue** — MRR, 30-day revenue, active customers, conversions (Stripe)
- **Audience** — follower/subscriber counts + daily deltas across YouTube,
  Instagram, TikTok, X/Twitter, and Reddit
- **Website** — page views and unique visitors (Vercel Web Analytics)
- **System** — CPU / temperature / RAM / disk / uptime and an optional service
  health indicator (Linux hosts only)
- **Cost** — a small monthly Apify usage tracker (spend vs. plan cap)

## Data sources

| Source | Data | Auth |
|--------|------|------|
| YouTube Data API v3 | subscriber/view/video counts | API key |
| Apify actor | Instagram / TikTok / X follower counts | token |
| Reddit OAuth | profile followers + karma | script-app client credentials |
| Stripe | MRR, revenue, customers, conversions | restricted read-only key |
| Vercel Web Analytics | page views, unique visitors | account token |
| `/proc`, `df`, `systemctl` | host system stats | local (Linux only) |

A background scheduler is the only code that calls external APIs. It writes to
an in-memory cache (and SQLite snapshots for history/deltas); API routes only
read the cache. Each source has its own polling cadence with exponential
backoff, and the cache warms from SQLite on boot so a restart shows last-known
values immediately.

## Architecture

```
scheduler (per-source cadence) ──> in-memory cache ──> /api/metrics ─┐
        │                              │                              │
        └─> SQLite snapshots ──────────┴──> /api/metrics/history      ├─> SWR → React UI
                                                                      │
host /proc reads ────────────────────> /api/system ───────────────────┘
```

- **Framework:** Next.js (App Router, `output: "standalone"`), TypeScript
- **Storage:** better-sqlite3 (WAL) for historical snapshots
- **Client:** SWR polling, Chart-free numeric deltas, fluid CSS that fills any
  viewport in portrait or landscape with no scrolling

## Setup

```bash
npm install
cp .env.example .env   # then fill in the keys you have
npm run dev            # http://localhost:3100
```

Every source is optional — unconfigured ones render "Not configured" and the
rest work. See [`.env.example`](.env.example) for all variables. A status page
at `/setup` shows which keys are present (never their values) and the live fetch
status per source.

### Reddit

Reddit blocks unauthenticated reads, so it uses OAuth: create a **script** app
at <https://www.reddit.com/prefs/apps>, then set `REDDIT_CLIENT_ID`,
`REDDIT_CLIENT_SECRET`, and `REDDIT_USERNAME`.

## Deploy (Raspberry Pi / any Linux box)

Builds to a self-contained `.next/standalone` bundle run by a systemd service.
`deploy.ps1` automates build → package → copy → restart for a Pi target; adapt
the host/path variables at the top for your machine. The native `better-sqlite3`
addon is rebuilt for the target architecture on deploy. Secrets live only in
`.env` (git-ignored), copied to the host separately with `chmod 600`.

## Security

- All credentials live in `.env`, which is git-ignored — nothing secret is
  committed. `.env.example` is the only committed env file and contains no values.
- The SQLite database and any machine-specific notes are git-ignored.

## License

MIT — see [LICENSE](LICENSE).
