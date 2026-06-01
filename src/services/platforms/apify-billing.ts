import { fetchJson } from "@/lib/fetcher";
import type { MetricValues } from "@/lib/constants";

// Apify cost tracker. APIFY_API_TOKEN holds the full run endpoint URL with the
// token appended (…?token=apify_api_xxx); we extract that token and query the
// account limits endpoint, which returns BOTH current monthly spend and the cap
// in one free call:
//   GET /v2/users/me/limits → { data: { current:{ monthlyUsageUsd }, limits:{ maxMonthlyUsageUsd } } }

interface LimitsResponse {
  data?: {
    current?: { monthlyUsageUsd?: number };
    limits?: { maxMonthlyUsageUsd?: number };
  };
}

/** Pull the bare token out of the APIFY_API_TOKEN value (URL or raw token). */
export function extractToken(): string | null {
  const raw = process.env.APIFY_API_TOKEN;
  if (!raw) return null;
  const m = raw.match(/token=([^&\s]+)/);
  if (m) return m[1];
  if (/^apify_api_/.test(raw.trim())) return raw.trim();
  return null;
}

export function isConfigured(): boolean {
  return extractToken() !== null;
}

export async function fetchApifyBilling(): Promise<MetricValues> {
  const token = extractToken();
  if (!token) throw new Error("Apify billing: no token found in APIFY_API_TOKEN");

  const res = await fetchJson<LimitsResponse>(
    `https://api.apify.com/v2/users/me/limits?token=${encodeURIComponent(token)}`,
  );
  const cost = res.data?.current?.monthlyUsageUsd;
  const limit = res.data?.limits?.maxMonthlyUsageUsd;
  if (typeof cost !== "number") throw new Error("Apify billing: unexpected response shape");

  return {
    costUsd: cost,
    limitUsd: typeof limit === "number" ? limit : 5,
  };
}
