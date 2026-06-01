import fs from "node:fs";
import path from "node:path";
import type Database from "better-sqlite3";
import { LOG_RETENTION_DAYS, SNAPSHOT_RETENTION_DAYS } from "./constants";

// Singleton SQLite handle, stored on globalThis so the scheduler and route
// handlers share ONE connection even if Next bundles them separately. Lazily
// opened; degrades gracefully if the native addon can't load (serverless) —
// the app then runs cache-only.
const g = globalThis as unknown as {
  __dashDb?: Database.Database | null;
  __dashDbTried?: boolean;
};

function open(): Database.Database | null {
  if (g.__dashDbTried) return g.__dashDb ?? null;
  g.__dashDbTried = true;
  try {
    // Require lazily so non-Node/serverless environments don't crash on import.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const BetterSqlite3 = require("better-sqlite3") as typeof Database;
    const dbPath = process.env.DATABASE_PATH || "./data/dashboard.db";
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
    const handle = new BetterSqlite3(dbPath);
    handle.pragma("journal_mode = WAL");
    handle.pragma("synchronous = NORMAL");
    migrate(handle);
    g.__dashDb = handle;
  } catch (err) {
    console.error("[db] SQLite unavailable, running cache-only:", err);
    g.__dashDb = null;
  }
  return g.__dashDb ?? null;
}

function migrate(handle: Database.Database) {
  handle.exec(`
    CREATE TABLE IF NOT EXISTS metric_snapshots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      platform TEXT NOT NULL,
      metric_name TEXT NOT NULL,
      metric_value REAL NOT NULL,
      recorded_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_snap
      ON metric_snapshots(platform, metric_name, recorded_at);

    CREATE TABLE IF NOT EXISTS fetch_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      platform TEXT NOT NULL,
      status TEXT NOT NULL,
      error_message TEXT,
      recorded_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);
  // Additive migration for the live-log value summary ("stripe ok — MRR $13").
  // migrate() only does CREATE TABLE IF NOT EXISTS, so add the column guarded —
  // it throws "duplicate column" on already-migrated databases, which we ignore.
  try {
    handle.exec("ALTER TABLE fetch_logs ADD COLUMN summary TEXT");
  } catch {
    /* column already exists */
  }
}

export function dbAvailable(): boolean {
  return open() !== null;
}

/** Persist a batch of metric values for one platform as snapshots. */
export function insertSnapshots(platform: string, values: Record<string, number>) {
  const handle = open();
  if (!handle) return;
  const stmt = handle.prepare(
    "INSERT INTO metric_snapshots (platform, metric_name, metric_value) VALUES (?, ?, ?)",
  );
  const tx = handle.transaction((entries: [string, number][]) => {
    for (const [name, value] of entries) {
      if (Number.isFinite(value)) stmt.run(platform, name, value);
    }
  });
  tx(Object.entries(values));
}

export function logFetch(platform: string, status: string, errorMessage?: string, summary?: string) {
  const handle = open();
  if (!handle) return;
  handle
    .prepare("INSERT INTO fetch_logs (platform, status, error_message, summary) VALUES (?, ?, ?, ?)")
    .run(platform, status, errorMessage ?? null, summary ?? null);
}

export interface LogRow {
  id: number;
  platform: string;
  status: string;
  error_message: string | null;
  summary: string | null;
  recorded_at: string;
}

/** Most recent fetch-log rows, newest first — feeds the live activity log. */
export function getRecentLogs(limit = 40): LogRow[] {
  const handle = open();
  if (!handle) return [];
  return handle
    .prepare(
      `SELECT id, platform, status, error_message, summary, recorded_at
         FROM fetch_logs
        ORDER BY recorded_at DESC, id DESC
        LIMIT ?`,
    )
    .all(limit) as LogRow[];
}

/**
 * Upsert ONE day's value for a metric (recorded_at pinned to that calendar day).
 * Used for true daily series (e.g. Vercel views/visitors) so the chart builds a
 * real 30-day history over time — one row per day, latest value wins.
 */
export function recordDailySnapshot(platform: string, metricName: string, value: number, dayIso: string) {
  const handle = open();
  if (!handle || !Number.isFinite(value)) return;
  const recordedAt = /^\d{4}-\d{2}-\d{2}$/.test(dayIso) ? `${dayIso} 12:00:00` : dayIso;
  const existing = handle
    .prepare(
      `SELECT id FROM metric_snapshots
        WHERE platform = ? AND metric_name = ? AND date(recorded_at) = date(?) LIMIT 1`,
    )
    .get(platform, metricName, recordedAt) as { id: number } | undefined;
  if (existing) {
    handle.prepare("UPDATE metric_snapshots SET metric_value = ? WHERE id = ?").run(value, existing.id);
  } else {
    handle
      .prepare(
        "INSERT INTO metric_snapshots (platform, metric_name, metric_value, recorded_at) VALUES (?, ?, ?, ?)",
      )
      .run(platform, metricName, value, recordedAt);
  }
}

export interface HistoryPoint {
  value: number;
  recorded_at: string;
}

/** Time-series for one metric since `sinceMs` ago (default 30 days). */
export function getHistory(
  platform: string,
  metricName: string,
  sinceMs = 30 * 24 * 60 * 60 * 1000,
): HistoryPoint[] {
  const handle = open();
  if (!handle) return [];
  const sinceIso = new Date(Date.now() - sinceMs).toISOString();
  return handle
    .prepare(
      `SELECT metric_value AS value, recorded_at
         FROM metric_snapshots
        WHERE platform = ? AND metric_name = ? AND recorded_at >= ?
        ORDER BY recorded_at ASC`,
    )
    .all(platform, metricName, sinceIso) as HistoryPoint[];
}

/**
 * Delta vs the snapshot nearest to ~24h ago. Returns null when there's no
 * baseline yet (first day of running).
 */
export function getDelta(
  platform: string,
  metricName: string,
  currentValue: number,
  aroundMs = 24 * 60 * 60 * 1000,
): number | null {
  const handle = open();
  if (!handle) return null;
  const targetIso = new Date(Date.now() - aroundMs).toISOString();
  const row = handle
    .prepare(
      `SELECT metric_value AS value
         FROM metric_snapshots
        WHERE platform = ? AND metric_name = ?
        ORDER BY ABS(strftime('%s', recorded_at) - strftime('%s', ?)) ASC
        LIMIT 1`,
    )
    .get(platform, metricName, targetIso) as { value: number } | undefined;
  if (!row) return null;
  return currentValue - row.value;
}

export interface LatestEntry {
  values: Record<string, number>;
  fetchedAt: number;
}

/** Latest value per (platform, metric), grouped by platform — used to warm the
 *  in-memory cache on boot so a restart shows last-known data immediately. */
export function getLatestByPlatform(): Record<string, LatestEntry> {
  const handle = open();
  if (!handle) return {};
  const rows = handle
    .prepare(
      `SELECT platform, metric_name, metric_value AS value, MAX(recorded_at) AS recorded_at
         FROM metric_snapshots
        GROUP BY platform, metric_name`,
    )
    .all() as { platform: string; metric_name: string; value: number; recorded_at: string }[];
  const out: Record<string, LatestEntry> = {};
  for (const r of rows) {
    // SQLite stores CURRENT_TIMESTAMP as "YYYY-MM-DD HH:MM:SS" in UTC.
    const ts = Date.parse(r.recorded_at.replace(" ", "T") + "Z");
    if (!out[r.platform]) out[r.platform] = { values: {}, fetchedAt: 0 };
    out[r.platform].values[r.metric_name] = r.value;
    if (Number.isFinite(ts) && ts > out[r.platform].fetchedAt) out[r.platform].fetchedAt = ts;
  }
  return out;
}

/** Delete snapshots/logs past their retention windows. */
export function cleanupOldData() {
  const handle = open();
  if (!handle) return;
  const snapCutoff = new Date(
    Date.now() - SNAPSHOT_RETENTION_DAYS * 24 * 60 * 60 * 1000,
  ).toISOString();
  const logCutoff = new Date(
    Date.now() - LOG_RETENTION_DAYS * 24 * 60 * 60 * 1000,
  ).toISOString();
  handle.prepare("DELETE FROM metric_snapshots WHERE recorded_at < ?").run(snapCutoff);
  handle.prepare("DELETE FROM fetch_logs WHERE recorded_at < ?").run(logCutoff);
}
