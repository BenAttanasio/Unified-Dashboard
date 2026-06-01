import { fetchJson } from "@/lib/fetcher";
import type { MetricValues } from "@/lib/constants";

// Apify cost tracker. The APIFY_*_API_ENDPOINT vars each hold a full run endpoint
// URL with the token appended (…?token=apify_api_xxx); they all share one account
// token, so we extract it from whichever endpoint is configured and query the
// account limits endpoint, which returns BOTH current monthly spend and the cap
// in one free call:
//   GET /v2/users/me/limits → { data: { current:{ monthlyUsageUsd }, limits:{ maxMonthlyUsageUsd } } }

interface LimitsResponse {
  data?: {
    current?: { monthlyUsageUsd?: number };
    limits?: { maxMonthlyUsageUsd?: number };
  };
}

/** Pull the bare token out of whichever Apify endpoint is configured (they all
 *  share one account token). Accepts a full run-endpoint URL or a raw token. */
export function extractToken(): string | null {
  const raw =
    process.env.APIFY_SOCIAL_API_ENDPOINT ??
    process.env.APIFY_TIKTOK_API_ENDPOINT ??
    process.env.APIFY_SKOOL_API_ENDPOINT;
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
  if (!token) throw new Error("Apify billing: no token found in any APIFY_*_API_ENDPOINT");

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
