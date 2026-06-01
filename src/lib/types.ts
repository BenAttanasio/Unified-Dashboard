import type { FetchStatus } from "./constants";

// Shapes returned by the API routes, shared with client components (type-only,
// so no server code is pulled into the browser bundle).

export interface SocialMetric {
  key: string;
  label: string;
  status: FetchStatus;
  fetchedAt: number | null;
  count: number | null;
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
  service?: { label: string; status: string };
  uptime?: string;
}
