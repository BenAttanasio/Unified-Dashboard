import { fetchJson } from "@/lib/fetcher";
import type { MetricValues } from "@/lib/constants";

// First-party website analytics from benattanasio.com's /api/stats endpoint.
//
// Why first-party (not Vercel): Vercel Web Analytics has no public read API, and
// the internal endpoint the old vercel.ts used now 404s. The site tracks its own
// pageviews / unique visitors / sessions / CTA clicks into Upstash and serves them
// at /api/stats, so this is a clean, documented JSON contract we own.
//
// Set SITE_STATS_URL to the full https://…/api/stats URL and SITE_STATS_TOKEN to
// the shared secret (appended as ?token=).

interface StatsWindow {
  pageviews?: number;
  visitors?: number;
  clicks_total?: number;
  clicks_by_location?: Record<string, number>;
  sessions?: number;
  engaged?: number;
  bounce_rate?: number; // 0..1
  ctr?: number; // 0..1  (clicks ÷ pageviews)
  conversion?: number; // 0..1  (clicks ÷ unique visitors)
}

interface StatsResponse {
  updatedAt?: string;
  windows?: { "7d"?: StatsWindow; "30d"?: StatsWindow };
  daily?: Array<{
    date: string;
    pageviews?: number;
    visitors?: number;
    clicks?: number;
    bounce_rate?: number;
  }>;
}

/** One day of site traffic, persisted as daily snapshots for the 30-day charts. */
export interface SiteDaily {
  date: string;
  pageviews: number;
  visitors: number;
  clicks: number;
  bounce: number; // 0..1
}

export interface SiteResult {
  /** Headline 7-day rollup (+ per-location click counts as loc_* keys). */
  values: MetricValues;
  daily: SiteDaily[];
}

export function isConfigured(): boolean {
  return Boolean(process.env.SITE_STATS_URL);
}

/** Sanitize a location label into a metric-key-safe suffix. */
function locKey(loc: string): string {
  return "loc_" + loc.replace(/[^a-zA-Z0-9]+/g, "_").replace(/^_+|_+$/g, "").toLowerCase();
}

export async function fetchSite(): Promise<SiteResult> {
  const base = process.env.SITE_STATS_URL!;
  const token = process.env.SITE_STATS_TOKEN;
  const url = token
    ? `${base}${base.includes("?") ? "&" : "?"}token=${encodeURIComponent(token)}`
    : base;

  const data = await fetchJson<StatsResponse>(url);
  const w = data.windows?.["7d"] ?? {};

  const values: MetricValues = {
    pageviews7d: w.pageviews ?? 0,
    visitors7d: w.visitors ?? 0,
    clicks7d: w.clicks_total ?? 0,
    ctr: w.ctr ?? 0,
    conversion: w.conversion ?? 0,
    bounce: w.bounce_rate ?? 0,
  };
  for (const [loc, n] of Object.entries(w.clicks_by_location ?? {})) {
    values[locKey(loc)] = typeof n === "number" ? n : 0;
  }

  const daily: SiteDaily[] = (data.daily ?? []).map((d) => ({
    date: d.date,
    pageviews: d.pageviews ?? 0,
    visitors: d.visitors ?? 0,
    clicks: d.clicks ?? 0,
    bounce: d.bounce_rate ?? 0,
  }));

  return { values, daily };
}
