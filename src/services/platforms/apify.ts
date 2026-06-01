import { fetchJson } from "@/lib/fetcher";
import type { MetricValues } from "@/lib/constants";

// All-in-one social follower scraper: k1ra/social-media-followers-scraper.
// APIFY_API_TOKEN holds the full run-sync-get-dataset-items endpoint URL with
// the ?token=... appended, so we just POST the input and get dataset items back.
//
// Input schema (per actor docs): { instagram:[], tiktok:[], twitter:[], reddit:[] }
//   - usernames WITHOUT the leading @
//   - NOTE: the actor's `reddit` field is designed for SUBREDDIT names (member
//     count), not user profiles. We still pass REDDIT_USERNAME best-effort; if
//     the actor returns nothing usable for it, Reddit simply shows stale/empty.

// Reddit is handled separately (reddit.ts via OAuth) — the actor's reddit field
// is subreddit-based and doesn't fit user profiles.
export type ApifyResults = Partial<Record<"instagram" | "tiktok" | "twitter", MetricValues>>;

export function isConfigured(): boolean {
  return Boolean(process.env.APIFY_API_TOKEN);
}

/** True if at least one social username is set (otherwise nothing to scrape). */
export function hasProfiles(): boolean {
  return Boolean(
    process.env.INSTAGRAM_USERNAME || process.env.TIKTOK_USERNAME || process.env.TWITTER_USERNAME,
  );
}

function buildInput(): Record<string, string[]> {
  const input: Record<string, string[]> = {};
  if (process.env.INSTAGRAM_USERNAME) input.instagram = [process.env.INSTAGRAM_USERNAME];
  if (process.env.TIKTOK_USERNAME) input.tiktok = [process.env.TIKTOK_USERNAME];
  if (process.env.TWITTER_USERNAME) input.twitter = [process.env.TWITTER_USERNAME];
  return input;
}

type AnyItem = Record<string, unknown>;

const COUNT_KEYS = [
  "followers",
  "followerCount",
  "followersCount",
  "followers_count",
  "subscribers",
  "subscriberCount",
  "subscriber_count",
  "members",
  "memberCount",
  "fans",
];

function pickCount(item: AnyItem): number | null {
  for (const k of COUNT_KEYS) {
    const v = item[k];
    if (typeof v === "number" && Number.isFinite(v)) return v;
    if (typeof v === "string" && v.trim() !== "" && !Number.isNaN(Number(v))) return Number(v);
  }
  return null;
}

function detectPlatform(item: AnyItem): keyof ApifyResults | null {
  const raw = String(item.platform ?? item.network ?? item.source ?? item.site ?? "").toLowerCase();
  if (raw.includes("insta")) return "instagram";
  if (raw.includes("tiktok")) return "tiktok";
  if (raw.includes("twitter") || raw === "x") return "twitter";

  // Fallback: infer from which configured username the item's handle matches.
  const handle = String(item.username ?? item.handle ?? item.profile ?? "").toLowerCase().replace(/^@/, "");
  if (handle && handle === process.env.INSTAGRAM_USERNAME?.toLowerCase()) return "instagram";
  if (handle && handle === process.env.TIKTOK_USERNAME?.toLowerCase()) return "tiktok";
  if (handle && handle === process.env.TWITTER_USERNAME?.toLowerCase()) return "twitter";
  return null;
}

export function parseItems(items: AnyItem[]): ApifyResults {
  const out: ApifyResults = {};
  for (const item of items) {
    const platform = detectPlatform(item);
    const count = pickCount(item);
    if (!platform || count == null) continue;
    out[platform] = { followers: count };
  }
  return out;
}

export async function fetchApify(): Promise<ApifyResults> {
  const endpoint = process.env.APIFY_API_TOKEN!;
  const input = buildInput();
  // run-sync waits for the scrape to finish — allow up to 4 minutes.
  const items = await fetchJson<AnyItem[]>(
    endpoint,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    },
    240_000,
  );
  if (!Array.isArray(items)) throw new Error("Apify: unexpected response (not an array)");
  return parseItems(items);
}
