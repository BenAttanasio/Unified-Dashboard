import { fetchJson } from "@/lib/fetcher";
import type { MetricValues } from "@/lib/constants";

// Skool community scraper via Apify actor gordian/skool-group-scraper
// (pay-per-result, takes a direct group URL/slug — no monthly rental).
// APIFY_SKOOL_API_ENDPOINT holds the full run-sync-get-dataset-items endpoint URL
// with the ?token=... appended; SKOOL_GROUP is the group slug (e.g. "my-group")
// or a full https://www.skool.com/... URL.
//
// The actor returns one item per group with flat fields: totalMembers,
// totalOnlineMembers, totalPosts, displayName, etc. We persist members (headline)
// plus online/posts for free (future use), mirroring how YouTube views ride along.
//
// NOTE: Skool exposes no public landing-page visitor/conversion analytics, so the
// member count is the headline metric here.

type AnyItem = Record<string, unknown>;

// Headline member count — gordian uses `totalMembers`; the rest are fallbacks for
// other actors should the endpoint ever change.
const MEMBER_KEYS = ["totalMembers", "members", "memberCount", "membersCount", "numMembers"];
const ONLINE_KEYS = ["totalOnlineMembers", "onlineMembers", "online"];
const POST_KEYS = ["totalPosts", "posts", "numPosts"];

export function isConfigured(): boolean {
  return Boolean(process.env.APIFY_SKOOL_API_ENDPOINT && process.env.SKOOL_GROUP);
}

function readNum(item: AnyItem, keys: string[]): number | null {
  for (const k of keys) {
    const v = item[k];
    if (typeof v === "number" && Number.isFinite(v)) return v;
    if (typeof v === "string" && v.trim() !== "" && !Number.isNaN(Number(v))) return Number(v);
  }
  return null;
}

/** SKOOL_GROUP may be a bare slug or a full URL; normalise to a skool.com URL. */
function groupUrl(group: string): string {
  return /^https?:\/\//i.test(group) ? group : `https://www.skool.com/${group}`;
}

export async function fetchSkool(): Promise<MetricValues> {
  const endpoint = process.env.APIFY_SKOOL_API_ENDPOINT!;
  const group = process.env.SKOOL_GROUP!;
  const url = groupUrl(group);
  // run-sync waits for the scrape to finish — allow up to 4 minutes.
  const items = await fetchJson<AnyItem[]>(
    endpoint,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      // Pass the group under several common input keys so this is robust across
      // actor versions; unknown keys are ignored by the actor.
      body: JSON.stringify({
        startUrls: [{ url }],
        urls: [url],
        groups: [group],
        group,
        maxItems: 1,
      }),
    },
    240_000,
  );
  if (!Array.isArray(items)) throw new Error("Skool: unexpected response (not an array)");
  for (const item of items) {
    const members = readNum(item, MEMBER_KEYS);
    if (members == null) continue;
    const out: MetricValues = { members };
    const online = readNum(item, ONLINE_KEYS);
    const posts = readNum(item, POST_KEYS);
    if (online != null) out.online = online;
    if (posts != null) out.posts = posts;
    return out;
  }
  throw new Error("Skool: no member-count field found in scraped items");
}
