import { fetchJson } from "@/lib/fetcher";
import type { MetricValues } from "@/lib/constants";

// TikTok profile scraper (SEPARATE paid Apify actor from the followers scraper).
// APIFY_TIKTOK_API_ENDPOINT holds the full run-sync-get-dataset-items endpoint
// URL with the ?token=... appended; we POST the handle and read the profile's
// total likes/hearts out of the returned dataset items.
//
// Isolated from apify.ts on purpose so the (cheap, shared) followers call is
// never affected and this feature no-ops cleanly when its endpoint is unset.

type AnyItem = Record<string, unknown>;

// PROFILE total likes/hearts. Crucial: this is the lifetime hearts received across
// the whole profile, NOT a single video's likes. The common video-scraper output
// (e.g. clockworks/tiktok-scraper) returns video items whose PER-VIDEO likes live
// at the top level (`diggCount`), while the PROFILE total lives nested in
// `authorMeta.heart`. So we look inside the profile/author container FIRST and only
// consider profile-level field names — never the top-level per-video `diggCount`.
const PROFILE_CONTAINERS = ["authorMeta", "authorStats", "userInfo", "user", "stats", "statistics"];
const LIKE_KEYS = [
  "heart",
  "heartCount",
  "hearts",
  "totalHearts",
  "likesCount",
  "likes",
  "total_favorited",
  "totalLikes",
];

export function isConfigured(): boolean {
  return Boolean(process.env.APIFY_TIKTOK_API_ENDPOINT && process.env.TIKTOK_USERNAME);
}

function readKey(c: AnyItem): number | null {
  for (const k of LIKE_KEYS) {
    const v = c[k];
    if (typeof v === "number" && Number.isFinite(v)) return v;
    if (typeof v === "string" && v.trim() !== "" && !Number.isNaN(Number(v))) return Number(v);
  }
  return null;
}

function pickLikes(item: AnyItem): number | null {
  // Prefer a nested profile/author container (where the lifetime heart total lives).
  for (const sub of PROFILE_CONTAINERS) {
    const v = item[sub];
    if (v && typeof v === "object") {
      const n = readKey(v as AnyItem);
      if (n != null) return n;
    }
  }
  // Fallback: a flat profile-scraper that puts the total at the top level.
  return readKey(item);
}

export async function fetchTikTokLikes(): Promise<MetricValues> {
  const endpoint = process.env.APIFY_TIKTOK_API_ENDPOINT!;
  const username = process.env.TIKTOK_USERNAME!.replace(/^@/, "");
  // run-sync waits for the scrape to finish — allow up to 4 minutes.
  const items = await fetchJson<AnyItem[]>(
    endpoint,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      // Pass the handle under several common input keys so this works across
      // actors without per-actor config; extra keys are ignored by the actor.
      body: JSON.stringify({
        profiles: [username],
        usernames: [username],
        username,
      }),
    },
    240_000,
  );
  if (!Array.isArray(items)) throw new Error("TikTok likes: unexpected response (not an array)");
  for (const item of items) {
    const likes = pickLikes(item);
    if (likes != null) return { likes };
  }
  throw new Error("TikTok likes: no likes/hearts field found in scraped items");
}
