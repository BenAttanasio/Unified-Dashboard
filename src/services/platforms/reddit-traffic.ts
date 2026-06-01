import { fetchJson } from "@/lib/fetcher";
import type { MetricValues } from "@/lib/constants";

// True subreddit TRAFFIC (weekly unique visitors) for a subreddit you MODERATE.
// This is private, moderator-only data exposed at /r/<sub>/about/traffic and is
// NOT the same as the public member count (that comes from Apify, see apify.ts).
//
// It needs a USER-context OAuth token (password grant on a "script" app), not the
// app-only client_credentials grant used by reddit.ts — moderator scope requires
// a user. The script app's owner must be the moderator of REDDIT_TRAFFIC_SUBREDDIT.
//
// Dormant until Reddit API access is approved + these are set in the Pi .env:
//   REDDIT_CLIENT_ID, REDDIT_CLIENT_SECRET, REDDIT_USERNAME, REDDIT_PASSWORD,
//   REDDIT_TRAFFIC_SUBREDDIT

const UA = "unified-dashboard/1.0 (business dashboard)";

const g = globalThis as unknown as { __redditUserToken?: { value: string; expiresAt: number } };

export function isConfigured(): boolean {
  return Boolean(
    process.env.REDDIT_CLIENT_ID &&
      process.env.REDDIT_CLIENT_SECRET &&
      process.env.REDDIT_USERNAME &&
      process.env.REDDIT_PASSWORD &&
      process.env.REDDIT_TRAFFIC_SUBREDDIT,
  );
}

async function getUserToken(): Promise<string> {
  const cached = g.__redditUserToken;
  if (cached && Date.now() < cached.expiresAt - 60_000) return cached.value;

  const id = process.env.REDDIT_CLIENT_ID!;
  const secret = process.env.REDDIT_CLIENT_SECRET!;
  const basic = Buffer.from(`${id}:${secret}`).toString("base64");

  const body = new URLSearchParams({
    grant_type: "password",
    username: process.env.REDDIT_USERNAME!,
    password: process.env.REDDIT_PASSWORD!,
    scope: "modconfig read",
  });

  const res = await fetchJson<{ access_token: string; expires_in: number }>(
    "https://www.reddit.com/api/v1/access_token",
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${basic}`,
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": UA,
      },
      body: body.toString(),
    },
  );
  g.__redditUserToken = { value: res.access_token, expiresAt: Date.now() + res.expires_in * 1000 };
  return res.access_token;
}

interface TrafficResponse {
  // Each entry: [epoch_seconds, uniques, pageviews] (subscribers added for some).
  week?: number[][];
  day?: number[][];
}

export async function fetchRedditTraffic(): Promise<MetricValues> {
  const sub = process.env.REDDIT_TRAFFIC_SUBREDDIT!;
  const token = await getUserToken();

  const res = await fetchJson<TrafficResponse>(
    `https://oauth.reddit.com/r/${encodeURIComponent(sub)}/about/traffic`,
    { headers: { Authorization: `Bearer ${token}`, "User-Agent": UA } },
  );

  // Take the most recent COMPLETE week (the last row is usually the partial
  // current week, so prefer the second-to-last when we have two+).
  const weeks = res.week ?? [];
  const row = weeks.length >= 2 ? weeks[weeks.length - 2] : weeks[weeks.length - 1];
  if (!row) throw new Error("Reddit traffic: no weekly data returned");

  return {
    weekly_visitors: row[1] ?? 0,
    weekly_pageviews: row[2] ?? 0,
  };
}
