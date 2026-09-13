import { readFileSync, statSync } from "node:fs";
import path from "node:path";

/**
 * Reads the performance snapshot produced by the Content Creation Pipeline.
 *
 * ARCHITECTURE NOTE — this deliberately inverts the usual rule.
 *
 * Everywhere else in this app the scheduler is the only thing that touches an
 * external source, and API routes read cache/live-store. Performance data is
 * different: the analysis needs local files that live on the workstation and
 * not on the Pi (videos's state.json, the .claude rule docs, and the rule
 * change log), and the YouTube OAuth token lives there too. So the pipeline
 * repo is the system of record and this dashboard is a read-only viewer.
 *
 * The snapshot arrives via tools/push-perf-snapshot.ps1 (scp), the same way
 * deploy.ps1 ships .env and coach-guidelines.md.
 */

export interface Cohort {
  n: number;
  median: number | null;
  mean: number | null;
  total: number | null;
  low_n: boolean;
}

export interface Funnel {
  platform: string;
  surface: string | null;
  window: [string, string];
  posts: number;
  impressions_label: string | null;
  clicks_label: string | null;
  impressions: Cohort;
  clicks: Cohort;
  views: Cohort;
  engagements: Cohort;
  ctr_reported: Cohort;
  ctr_derived_pct: number | null;
  views_per_reach: number | null;
  avg_watch_seconds: Cohort;
  avg_view_pct: Cohort;
}

export interface FeatureRow {
  feature: string;
  metric: string;
  surface: string;
  with: Cohort;
  without: Cohort;
  multiple: number | null;
  inverted: boolean;
  low_n: boolean;
}

export interface RuleChange {
  id: string;
  rule: string;
  applied_at: string;
  metric: string;
  scope: { platform?: string; surface?: string; affects?: string };
  predicted: { metric?: string; direction?: string; baseline?: number } | null;
  before: Cohort;
  after: Cohort;
  delta_pct: number | null;
  verdict: string;
}

/**
 * The cross-platform coach verdict, produced by tools/analytics/coach.py in the
 * pipeline repo and baked into the snapshot. Unlike the YouTube coach on this
 * box — whose verdict lives in live-store and dies on restart — this one is on
 * disk before it ever reaches the Pi.
 */
export interface CoachVerdict {
  headline: string;
  platforms: {
    platform: string;
    working: string[];
    avoid: string[];
    note: string;
  }[];
  title_ideas: { title: string; surface: string; why: string }[];
  pipeline_changes: {
    change: string;
    target: string;
    evidence: string;
    affects: string;
    confidence: "high" | "medium" | "low";
    reverses: string;
  }[];
  experiment: string;
  watch_next: string;
  generated_at: string;
  model: string;
}

export interface PerfSnapshot {
  generated_at: string;
  weeks: number;
  current_week: [string, string];
  ingest: Record<string, { status: string; rows: number; ran_at: string; note?: string }>;
  coverage: Record<string, { daily_rows?: number; posts?: number; from?: string; to?: string }>;
  funnels: Record<string, Record<string, { current_week: Funnel; prior_week: Funnel; trailing_4w: Funnel }>>;
  weekly: Record<string, Funnel[]>;
  features: Record<string, Record<string, FeatureRow[]>>;
  channel_daily: Record<string, Record<string, { day: string; value: number }[]>>;
  changes: RuleChange[];
  caveats: string[];
  /** Absent until tools/analytics/coach.py has run at least once. */
  coach?: CoachVerdict;
}

export interface PerfResult {
  status: "ok" | "missing" | "error";
  snapshot: PerfSnapshot | null;
  /** When the file was last written — how stale the numbers are. */
  fileModified: string | null;
  error?: string;
}

function snapshotPath(): string {
  if (process.env.PERF_SNAPSHOT_PATH) return process.env.PERF_SNAPSHOT_PATH;
  const db = process.env.DATABASE_PATH || "./data/dashboard.db";
  return path.join(path.dirname(db), "perf-snapshot.json");
}

export function readPerfSnapshot(): PerfResult {
  const file = snapshotPath();
  try {
    const raw = readFileSync(file, "utf8");
    return {
      status: "ok",
      snapshot: JSON.parse(raw) as PerfSnapshot,
      fileModified: statSync(file).mtime.toISOString(),
    };
  } catch (err) {
    const e = err as NodeJS.ErrnoException;
    if (e.code === "ENOENT") {
      return {
        status: "missing",
        snapshot: null,
        fileModified: null,
        error: `No snapshot at ${file}. Run tools/push-perf-snapshot.ps1 from the pipeline repo.`,
      };
    }
    return { status: "error", snapshot: null, fileModified: null, error: String(e.message ?? e) };
  }
}
