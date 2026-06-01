import { fetchJson } from "@/lib/fetcher";
import type { MetricValues } from "@/lib/constants";

// Subreddit MEMBER count via official OAuth (app-only / client_credentials grant).
// Reddit blocks unauthenticated JSON (403), so this needs a free "script" app:
//   https://www.reddit.com/prefs/apps → create app (type: script) →
//   REDDIT_CLIENT_ID (under the app name) + REDDIT_CLIENT_SECRET.
// Public subreddit subscriber count works with the app-only grant (no user
// needed). Weekly *visitors* (moderator-only) live in reddit-traffic.ts instead.
//
// Dormant until Reddit API access is approved + the env vars are set.

const UA = "unified-dashboard/1.0 (business dashboard)";

const g = globalThis as unknown as { __redditToken?: { value: string; expiresAt: number } };

export function isConfigured(): boolean {
  return Boolean(
    process.env.REDDIT_CLIENT_ID &&
      process.env.REDDIT_CLIENT_SECRET &&
      process.env.REDDIT_TRAFFIC_SUBREDDIT,
  );
}

async function getToken(): Promise<string> {
  const cached = g.__redditToken;
  if (cached && Date.now() < cached.expiresAt - 60_000) return cached.value;

  const id = process.env.REDDIT_CLIENT_ID!;
  const secret = process.env.REDDIT_CLIENT_SECRET!;
  const basic = Buffer.from(`${id}:${secret}`).toString("base64");

  const res = await fetchJson<{ access_token: string; expires_in: number }>(
    "https://www.reddit.com/api/v1/access_token",
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${basic}`,
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": UA,
      },
      body: "grant_type=client_credentials",
    },
  );
  g.__redditToken = { value: res.access_token, expiresAt: Date.now() + res.expires_in * 1000 };
  return res.access_token;
}

interface AboutResponse {
  data?: {
    subscribers?: number;
    active_user_count?: number;
  };
}

export async function fetchReddit(): Promise<MetricValues> {
  const sub = process.env.REDDIT_TRAFFIC_SUBREDDIT!;
  const token = await getToken();

  const res = await fetchJson<AboutResponse>(
    `https://oauth.reddit.com/r/${encodeURIComponent(sub)}/about`,
    { headers: { Authorization: `Bearer ${token}`, "User-Agent": UA } },
  );
  const d = res.data ?? {};
  return {
    members: d.subscribers ?? 0,
    online: d.active_user_count ?? 0,
  };
}
