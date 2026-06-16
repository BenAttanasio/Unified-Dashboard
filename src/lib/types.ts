import type { FetchStatus } from "./constants";

// Shapes returned by the API routes, shared with client components (type-only,
// so no server code is pulled into the browser bundle).

export interface SocialMetric {
  /** Unique row identity (React key). e.g. "youtube" or "youtube:views". */
  id: string;
  /** Platform: cache key + history/delta lookup key. e.g. "youtube". */
  key: string;
  label: string;
  /** The metric name to chart history for, e.g. "followers" / "members". */
  metric: string;
  status: FetchStatus;
  fetchedAt: number | null;
  count: number | null;
  /** Net change vs ~30 days ago (SOCIAL_DELTA_MS), matching the 30-day sparkline. */
  delta: number | null;
}

export interface RevenueMetric {
  status: FetchStatus;
  fetchedAt: number | null;
  mrr: number | null;
  revenue30d: number | null;
  customers: number | null;
  conversions: number | null;
  mrrDelta: number | null;
  revenue30dDelta: number | null;
}

export interface WebMetric {
  status: FetchStatus;
  fetchedAt: number | null;
  views7d: number | null;
  visitors7d: number | null;
}

export interface SiteMetric {
  status: FetchStatus;
  fetchedAt: number | null;
  /** 7-day rollups from benattanasio.com /api/stats. */
  pageviews7d: number | null;
  visitors7d: number | null;
  clicks7d: number | null;
  /** CTR = clicks ÷ pageviews (fraction 0..1). */
  ctr: number | null;
  /** Conversion = clicks ÷ unique visitors (fraction 0..1). */
  conversion: number | null;
  /** Bounce rate (fraction 0..1). */
  bounce: number | null;
  /** Per-placement CTA click counts, e.g. { hero: 12, footer: 4, topbar: 9 }. */
  clicksByLocation: Record<string, number>;
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
  revenue: RevenueMetric;
  web: WebMetric;
  site: SiteMetric;
  apify: ApifyBillingMetric;
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
