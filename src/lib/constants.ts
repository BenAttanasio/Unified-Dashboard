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
  "twitter",
  "site",
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
  /** Metric to chart, when it differs from the headline (e.g. a 7d rollup
   *  headline over a daily series). Defaults to countMetric. */
  chartMetric?: string;
  /** Small grey qualifier after the label, for rows whose unit isn't obvious. */
  hint?: string;
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
  { key: "twitter", label: "X / Twitter", countMetric: "followers", usernameEnv: "TWITTER_USERNAME" },
  // The website gets one line here rather than its own module — traffic is low
  // enough that the CTA funnel breakdown wasn't earning its screen space.
  // Headline is the 7-day visitor rollup; the chart is the daily visitor series.
  {
    key: "site",
    label: "benattanasio.com",
    countMetric: "visitors7d",
    chartMetric: "visitors",
    hint: "visitors · 7d",
    usernameEnv: "SITE_STATS_URL",
  },
];

// Polling intervals (ms).
//
// The paid Apify cadences were cut when the channel roster's IG/TikTok handles
// joined the shared scrape: one run now covers ~7 profiles instead of 3, so the
// per-run cost tripled. Daily is plenty — follower counts move slowly, and the
// "is it blowing up" signal comes from the (free) YouTube feed below.
export const INTERVALS = {
  youtube: 4 * 60 * 60 * 1000, // 4h
  apify: 24 * 60 * 60 * 1000, // 24h (one paid call covers every IG/TikTok/X profile)
  site: 5 * 60 * 1000, // 5m — first-party benattanasio.com analytics (/api/stats)
  apifyBilling: 30 * 60 * 1000, // 30m — cheap account usage check
  tiktokLikes: 24 * 60 * 60 * 1000, // 24h — separate paid Apify actor (cost-controlled)
  skool: 48 * 60 * 60 * 1000, // 48h — gordian actor is ~$8/1k results; every other day ≈ $0.50/mo
  weather: 15 * 60 * 1000, // 15m — free Open-Meteo forecast; weather changes slowly (shared heartbeat)
  ytVideos: 60 * 60 * 1000, // 1h — per-video stats, 3 quota units/fetch (free tier: 10k/day)
  coach: 12 * 60 * 60 * 1000, // 12h — Claude (Sonnet) analysis of recent videos; ~cents/month
  roster: 2 * 60 * 60 * 1000, // 2h — free YouTube API, ~11 quota units per fetch (~130/day)
  trading: 60 * 1000, // 1m — localhost GET against the AI Trader's /api/summary; free
} as const;

// "This channel is blowing up" thresholds, used by /api/roster.
// spike = best of the 3 newest uploads ÷ median of the older ones.
// accel = views gained in the last 7d ÷ views gained in the 7d before that.
export const ROSTER_SPIKE_HOT = 3;
export const ROSTER_ACCEL_HOT = 2;
/** Growth window for the roster rows (and the "prior week" comparison). */
export const ROSTER_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

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
