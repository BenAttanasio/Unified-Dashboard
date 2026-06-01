import { fetchJson } from "@/lib/fetcher";
import type { MetricValues } from "@/lib/constants";

// Reddit profile stats via official OAuth (app-only / client_credentials grant).
// Reddit blocks unauthenticated JSON (403), so this needs a free "script" app:
//   https://www.reddit.com/prefs/apps → create app (type: script) →
//   REDDIT_CLIENT_ID (under the app name) + REDDIT_CLIENT_SECRET.
// Returns the profile's follower count (u/<user> subreddit subscribers) + karma.

const UA = "unified-dashboard/1.0 (business dashboard)";

const g = globalThis as unknown as { __redditToken?: { value: string; expiresAt: number } };

export function isConfigured(): boolean {
  return Boolean(
    process.env.REDDIT_CLIENT_ID && process.env.REDDIT_CLIENT_SECRET && process.env.REDDIT_USERNAME,
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
    subreddit?: { subscribers?: number };
    total_karma?: number;
    link_karma?: number;
    comment_karma?: number;
  };
}

export async function fetchReddit(): Promise<MetricValues> {
  const user = process.env.REDDIT_USERNAME!;
  const token = await getToken();

  const res = await fetchJson<AboutResponse>(
    `https://oauth.reddit.com/user/${encodeURIComponent(user)}/about`,
    { headers: { Authorization: `Bearer ${token}`, "User-Agent": UA } },
  );
  const d = res.data ?? {};
  return {
    followers: d.subreddit?.subscribers ?? 0,
    karma: d.total_karma ?? 0,
  };
}
