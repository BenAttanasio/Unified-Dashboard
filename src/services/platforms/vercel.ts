import { fetchJson, HttpError } from "@/lib/fetcher";
import type { MetricValues } from "@/lib/constants";

// Vercel Web Analytics (page views / unique visitors over the last 7 days).
//
// This is NOT in the documented public REST API — it's the same internal
// endpoint the Vercel dashboard uses, called with the account's Bearer token
// (validated: the personal token authorizes it). Key details, confirmed live:
//   • Dates MUST be ISO strings (epoch ms → HTTP 400).
//   • Response shape: { data: { groups: { all: [ { key, total, devices, bounceRate } ] } } }
//       total   = page views (per day)
//       devices = unique visitors (per day)

interface TimeseriesResponse {
  data?: {
    groups?: {
      all?: Array<{ key: string; total?: number; devices?: number; bounceRate?: number }>;
    };
  };
}

/** One day of traffic, used to draw the 30-day daily charts. */
export interface DailyTraffic {
  date: string;
  views: number;
  visitors: number;
}

export interface VercelResult {
  /** Headline rolling-7d sums (kept for the big number + delta). */
  values: MetricValues;
  /** Per-day series; each point is persisted as a daily snapshot for the chart. */
  daily: DailyTraffic[];
}

export function isConfigured(): boolean {
  return Boolean(process.env.VERCEL_API_TOKEN && process.env.VERCEL_PROJECT_ID);
}

export async function fetchVercel(): Promise<VercelResult> {
  const token = process.env.VERCEL_API_TOKEN!;
  const projectId = process.env.VERCEL_PROJECT_ID!;
  const teamId = process.env.VERCEL_TEAM_ID;

  const now = Date.now();
  // 30-day window. NOTE: the team MUST own the project — a wrong/missing teamId
  // returns 403. Buckets are daily for a 30d range (hourly for short ranges), so
  // we aggregate by calendar day to be granularity-agnostic.
  const params = new URLSearchParams({
    projectId,
    environment: "production",
    from: new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString(),
    to: new Date(now).toISOString(),
  });
  if (teamId) params.set("teamId", teamId);

  const url = `https://vercel.com/api/web-analytics/timeseries?${params.toString()}`;

  let res: TimeseriesResponse;
  try {
    res = await fetchJson<TimeseriesResponse>(url, {
      headers: { Authorization: `Bearer ${token}` },
    });
  } catch (err) {
    if (err instanceof HttpError) {
      throw new Error(`Vercel Web Analytics HTTP ${err.status} (see vercel.ts)`);
    }
    throw err;
  }

  // Aggregate buckets into per-day totals (key is an ISO timestamp).
  const byDay = new Map<string, { views: number; visitors: number }>();
  for (const row of res.data?.groups?.all ?? []) {
    const day = (row.key || "").slice(0, 10); // YYYY-MM-DD
    if (!day) continue;
    const cur = byDay.get(day) ?? { views: 0, visitors: 0 };
    cur.views += typeof row.total === "number" ? row.total : 0;
    cur.visitors += typeof row.devices === "number" ? row.devices : 0;
    byDay.set(day, cur);
  }
  const daily: DailyTraffic[] = [...byDay.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, v]) => ({ date, views: v.views, visitors: v.visitors }));

  // Headline = sum of the most recent 7 days (rows are date-ascending).
  const last7 = daily.slice(-7);
  const views7d = last7.reduce((a, d) => a + d.views, 0);
  const visitors7d = last7.reduce((a, d) => a + d.visitors, 0);

  return { values: { views7d, visitors7d }, daily };
}
