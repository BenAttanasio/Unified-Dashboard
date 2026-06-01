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

export function isConfigured(): boolean {
  return Boolean(process.env.VERCEL_API_TOKEN && process.env.VERCEL_PROJECT_ID);
}

export async function fetchVercel(): Promise<MetricValues> {
  const token = process.env.VERCEL_API_TOKEN!;
  const projectId = process.env.VERCEL_PROJECT_ID!;
  const teamId = process.env.VERCEL_TEAM_ID;

  const now = Date.now();
  const params = new URLSearchParams({
    projectId,
    environment: "production",
    from: new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString(),
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

  const rows = res.data?.groups?.all ?? [];
  let views = 0;
  let visitors = 0;
  for (const row of rows) {
    if (typeof row.total === "number") views += row.total;
    if (typeof row.devices === "number") visitors += row.devices;
  }

  return { views7d: views, visitors7d: visitors };
}
