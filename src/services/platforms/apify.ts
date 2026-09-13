import { fetchJson } from "@/lib/fetcher";
import { byPlatform } from "@/lib/roster";

// All-in-one social follower scraper: k1ra/social-media-followers-scraper.
// APIFY_SOCIAL_API_ENDPOINT holds the full run-sync-get-dataset-items endpoint
// URL with the ?token=... appended, so we just POST the input and get dataset
// items back.
//
// Input schema (per actor docs): { instagram:[], tiktok:[], twitter:[] }
//   - usernames WITHOUT the leading @
//
// ONE run covers every tracked profile — the owner's IG/TikTok/X plus the
// channel roster's IG/TikTok handles (see src/lib/roster.ts). Batching them
// keeps this to a single paid run per cadence instead of one per profile.

/** Internal platform codes; `tw` has no roster equivalent. */
type Code = "ig" | "tt" | "tw";

/** Results keyed `${code}:${lowercased handle}` → follower count. */
export type ApifyResults = Record<string, number>;

/** Where one scraped profile lands: which cache key, under which metric name. */
export interface ApifyTarget {
  /** Key into ApifyResults. */
  resultKey: string;
  /** cache.ts / metric_snapshots key, e.g. "instagram" or "ch_dm_tt". */
  cacheKey: string;
  metric: string;
}

export function isConfigured(): boolean {
  return Boolean(process.env.APIFY_SOCIAL_API_ENDPOINT);
}

function norm(handle: string | undefined): string | null {
  const h = handle?.trim().replace(/^@/, "").toLowerCase();
  return h ? h : null;
}

/** Every handle we want scraped, grouped by platform code (deduped). */
function handles(): Record<Code, string[]> {
  const out: Record<Code, string[]> = { ig: [], tt: [], tw: [] };
  const add = (code: Code, handle: string | undefined) => {
    const h = norm(handle);
    if (h && !out[code].includes(h)) out[code].push(h);
  };
  add("ig", process.env.INSTAGRAM_USERNAME);
  add("tt", process.env.TIKTOK_USERNAME);
  add("tw", process.env.TWITTER_USERNAME);
  for (const e of byPlatform("ig")) add("ig", e.handle);
  for (const e of byPlatform("tt")) add("tt", e.handle);
  return out;
}

/** True if at least one profile is configured (otherwise nothing to scrape). */
export function hasProfiles(): boolean {
  const h = handles();
  return h.ig.length + h.tt.length + h.tw.length > 0;
}

/** The scheduler's routing table: scraped profile → cache key. */
export function targets(): ApifyTarget[] {
  const out: ApifyTarget[] = [];
  const push = (code: Code, handle: string | undefined, cacheKey: string) => {
    const h = norm(handle);
    if (h) out.push({ resultKey: `${code}:${h}`, cacheKey, metric: "followers" });
  };
  push("ig", process.env.INSTAGRAM_USERNAME, "instagram");
  push("tt", process.env.TIKTOK_USERNAME, "tiktok");
  push("tw", process.env.TWITTER_USERNAME, "twitter");
  for (const e of byPlatform("ig")) push("ig", e.handle, e.key);
  for (const e of byPlatform("tt")) push("tt", e.handle, e.key);
  return out;
}

function buildInput(): Record<string, string[]> {
  const h = handles();
  const input: Record<string, string[]> = {};
  if (h.ig.length) input.instagram = h.ig;
  if (h.tt.length) input.tiktok = h.tt;
  if (h.tw.length) input.twitter = h.tw;
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

function pickHandle(item: AnyItem): string | null {
  return norm(String(item.username ?? item.handle ?? item.profile ?? item.name ?? ""));
}

/**
 * Which platform an item belongs to. The same handle can exist on BOTH Instagram
 * and TikTok (it does, in this roster), so handle-matching is only a last resort
 * and only when the handle is unambiguous across the configured lists.
 */
function detectPlatform(item: AnyItem, handle: string | null): Code | null {
  const raw = String(item.platform ?? item.network ?? item.source ?? item.site ?? "").toLowerCase();
  if (raw.includes("insta")) return "ig";
  if (raw.includes("tiktok")) return "tt";
  if (raw.includes("twitter") || raw === "x") return "tw";

  const url = String(item.url ?? item.profileUrl ?? item.link ?? item.profile_url ?? "").toLowerCase();
  if (url.includes("instagram.com")) return "ig";
  if (url.includes("tiktok.com")) return "tt";
  if (url.includes("twitter.com") || url.includes("x.com")) return "tw";

  if (!handle) return null;
  const h = handles();
  const matches = (["ig", "tt", "tw"] as Code[]).filter((c) => h[c].includes(handle));
  return matches.length === 1 ? matches[0] : null;
}

export function parseItems(items: AnyItem[]): ApifyResults {
  const configured = handles();
  const out: ApifyResults = {};
  for (const item of items) {
    const found = pickHandle(item);
    const platform = detectPlatform(item, found);
    const count = pickCount(item);
    if (!platform || count == null) continue;
    // If the item's handle isn't one we asked for (or is missing entirely), it's
    // still unambiguous when only one profile was requested for that platform.
    const handle =
      found && configured[platform].includes(found)
        ? found
        : configured[platform].length === 1
          ? configured[platform][0]
          : null;
    if (!handle) continue;
    out[`${platform}:${handle}`] = count;
  }
  return out;
}

export async function fetchApify(): Promise<ApifyResults> {
  const endpoint = process.env.APIFY_SOCIAL_API_ENDPOINT!;
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
