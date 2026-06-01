// Shared config, types, and platform metadata for the whole app.

export type FetchStatus = "ok" | "error" | "rate_limited" | "not_configured";

/** A bag of named numeric metrics for one source, e.g. { subscribers: 12400 }. */
export type MetricValues = Record<string, number>;

/** Platform keys used as cache keys and SQLite `platform` values. */
export const PLATFORMS = [
  "youtube",
  "instagram",
  "tiktok",
  "tiktok_likes",
  "skool",
  "reddit",
  "twitter",
  "stripe",
  "vercel",
] as const;
export type Platform = (typeof PLATFORMS)[number];

/** The social platforms shown in the Audience section (follower-style counts). */
export interface SocialPlatformMeta {
  /** Unique row id (React key). Defaults to `${key}:${countMetric}` if omitted. */
  id?: string;
  key: Platform;
  label: string;
  /** Which metric in MetricValues is the headline follower/subscriber count. */
  countMetric: string;
  /** Username env var (presence => "configured"). */
  usernameEnv?: string;
}

export const SOCIAL_PLATFORMS: SocialPlatformMeta[] = [
  { key: "youtube", label: "YouTube", countMetric: "subscribers" },
  // Same "youtube" cache entry; views history is already persisted by the scheduler.
  { key: "youtube", label: "YouTube · Views", countMetric: "views" },
  { key: "instagram", label: "Instagram", countMetric: "followers", usernameEnv: "INSTAGRAM_USERNAME" },
  { key: "tiktok", label: "TikTok", countMetric: "followers", usernameEnv: "TIKTOK_USERNAME" },
  // TikTok total likes/hearts — separate paid Apify actor (see tiktok-likes.ts).
  { key: "tiktok_likes", label: "TikTok · Likes", countMetric: "likes", usernameEnv: "APIFY_TIKTOK_API_ENDPOINT" },
  // Skool community member count — separate paid Apify actor (see skool.ts).
  { key: "skool", label: "Skool", countMetric: "members", usernameEnv: "APIFY_SKOOL_API_ENDPOINT" },
  // Reddit row = subreddit MEMBER count (public, via Apify) — not user followers.
  { key: "reddit", label: "Reddit", countMetric: "members", usernameEnv: "REDDIT_TRAFFIC_SUBREDDIT" },
  { key: "twitter", label: "X / Twitter", countMetric: "followers", usernameEnv: "TWITTER_USERNAME" },
];

// Polling intervals (ms).
export const INTERVALS = {
  youtube: 4 * 60 * 60 * 1000, // 4h
  apify: 12 * 60 * 60 * 1000, // 12h (one paid call covers IG/TikTok/X; they move slowly)
  reddit: 4 * 60 * 60 * 1000, // 4h — subreddit member count via OAuth (dormant until approved)
  stripe: 5 * 60 * 1000, // 5m
  vercel: 10 * 60 * 1000, // 10m
  apifyBilling: 30 * 60 * 1000, // 30m — cheap account usage check
  redditTraffic: 6 * 60 * 60 * 1000, // 6h — moderator weekly traffic (dormant until approved)
  tiktokLikes: 8 * 60 * 60 * 1000, // 8h — separate paid Apify actor (cost-controlled)
  skool: 24 * 60 * 60 * 1000, // 24h — gordian actor is ~$50/1k results; daily ≈ $1.50/mo
} as const;

// Exponential backoff on failure: 1m → 5m → 15m cap.
export const BACKOFF_MS = [60_000, 5 * 60_000, 15 * 60_000];

// Window for the "change" number shown beside each social count. Matches the
// 30-day sparkline lookback so the delta reflects net growth over the same period
// (a 24h delta is near-zero for slow-moving follower/like counts).
export const SOCIAL_DELTA_MS = 30 * 24 * 60 * 60 * 1000;

// Retention.
export const SNAPSHOT_RETENTION_DAYS = 90;
export const LOG_RETENTION_DAYS = 7;

// Default fetch timeout for external HTTP calls.
export const FETCH_TIMEOUT_MS = 15_000;
