import type { FetchStatus } from "./constants";

// Shapes returned by the API routes, shared with client components (type-only,
// so no server code is pulled into the browser bundle).

export interface SocialMetric {
  /** Unique row identity (React key). e.g. "youtube" or "youtube:views". */
  id: string;
  /** Platform: cache key + history/delta lookup key. e.g. "youtube". */
  key: string;
  label: string;
  /** Small grey qualifier after the label (unit/window), when the meta sets one. */
  hint?: string;
  /** The metric name to chart history for, e.g. "followers" / "members". */
  metric: string;
  status: FetchStatus;
  fetchedAt: number | null;
  count: number | null;
  /** Net change vs ~30 days ago (SOCIAL_DELTA_MS), matching the 30-day sparkline. */
  delta: number | null;
}

export interface ApifyBillingMetric {
  status: FetchStatus;
  fetchedAt: number | null;
  costUsd: number | null;
  limitUsd: number | null;
}

export interface MetricsResponse {
  ts: string;
  social: SocialMetric[];
  apify: ApifyBillingMetric;
}

/**
 * One tracked roster channel. Deliberately carries NO handle, URL or channel
 * name — only the initials from ROSTER_CHANNELS — because this payload is
 * served to the browser and the repo is public.
 */
export interface RosterRow {
  /** Cache/history key, e.g. "ch_xy_yt". */
  key: string;
  /** Initials, e.g. "X.Y.". */
  label: string;
  platform: "yt" | "ig" | "tt";
  status: FetchStatus;
  fetchedAt: number | null;
  /** Headline count: total views (YouTube) or followers (IG / TikTok). */
  count: number | null;
  /** Metric name behind `count` — also what the sparkline charts. */
  metric: string;
  /** Subscriber count (YouTube only). */
  subscribers: number | null;
  /** Growth of `metric` over the last 7 days — or over whatever shorter span of
   *  history exists so far, in which case `windowDays` says how far it reaches. */
  d7: number | null;
  /** Actual span `d7` covers, in days (7 once there's a full week of history). */
  windowDays: number | null;
  /** Growth over the 7 days before that — the baseline `accel` compares against. */
  prev7: number | null;
  /** d7 ÷ prev7. >1 means growth is accelerating. */
  accel: number | null;
  /** YouTube: views of recent uploads, oldest → newest. */
  recentViews: number[];
  /** YouTube: best of the 3 newest uploads ÷ median of the older ones. */
  spike: number | null;
  /** YouTube: days since the newest upload. */
  lastUploadDays: number | null;
  /** Composite "oh shit, this is popping" flag (spike or acceleration). */
  hot: boolean;
  /** Configured, but its source hasn't run yet — distinct from "not configured". */
  pending: boolean;
}

export interface RosterResponse {
  status: FetchStatus;
  fetchedAt: number | null;
  channels: RosterRow[];
}

export interface SystemStatsView {
  disabled?: boolean;
  ts?: string;
  cpu?: { load1: number; load5: number; load15: number; cores: number };
  mem?: { total: number; used: number; pct: number };
  swap?: { total: number; used: number; pct: number };
  temp?: number;
  disk?: { total: number; used: number; pct: number };
  service?: { label: string; status: string; detail?: string };
  uptime?: string;
}
