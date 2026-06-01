// Shared config, types, and platform metadata for the whole app.

export type FetchStatus = "ok" | "error" | "rate_limited" | "not_configured";

/** A bag of named numeric metrics for one source, e.g. { subscribers: 12400 }. */
export type MetricValues = Record<string, number>;

/** Platform keys used as cache keys and SQLite `platform` values. */
export const PLATFORMS = [
  "youtube",
  "instagram",
  "tiktok",
  "reddit",
  "twitter",
  "stripe",
  "vercel",
] as const;
export type Platform = (typeof PLATFORMS)[number];

/** The social platforms shown in the Audience section (follower-style counts). */
export interface SocialPlatformMeta {
  key: Platform;
  label: string;
  /** Which metric in MetricValues is the headline follower/subscriber count. */
  countMetric: string;
  /** Username env var (presence => "configured"). */
  usernameEnv?: string;
}

export const SOCIAL_PLATFORMS: SocialPlatformMeta[] = [
  { key: "youtube", label: "YouTube", countMetric: "subscribers" },
  { key: "instagram", label: "Instagram", countMetric: "followers", usernameEnv: "INSTAGRAM_USERNAME" },
  { key: "tiktok", label: "TikTok", countMetric: "followers", usernameEnv: "TIKTOK_USERNAME" },
  { key: "reddit", label: "Reddit", countMetric: "followers", usernameEnv: "REDDIT_USERNAME" },
  { key: "twitter", label: "X / Twitter", countMetric: "followers", usernameEnv: "TWITTER_USERNAME" },
];

// Polling intervals (ms).
export const INTERVALS = {
  youtube: 4 * 60 * 60 * 1000, // 4h
  apify: 4 * 60 * 60 * 1000, // 4h (one call covers IG/TikTok/X)
  reddit: 4 * 60 * 60 * 1000, // 4h (OAuth, separate from Apify)
  stripe: 5 * 60 * 1000, // 5m
  vercel: 10 * 60 * 1000, // 10m
  apifyBilling: 30 * 60 * 1000, // 30m — cheap account usage check
} as const;

// Exponential backoff on failure: 1m → 5m → 15m cap.
export const BACKOFF_MS = [60_000, 5 * 60_000, 15 * 60_000];

// Retention.
export const SNAPSHOT_RETENTION_DAYS = 90;
export const LOG_RETENTION_DAYS = 7;

// Default fetch timeout for external HTTP calls.
export const FETCH_TIMEOUT_MS = 15_000;
