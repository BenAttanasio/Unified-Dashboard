import * as cache from "@/lib/cache";
import * as live from "@/lib/live-store";
import { insertSnapshots, recordDailySnapshot, logFetch, cleanupOldData, getLatestByPlatform } from "@/lib/db";
import { HttpError } from "@/lib/fetcher";
import { INTERVALS, type FetchStatus } from "@/lib/constants";
import { summarize } from "@/lib/log-summary";
import * as youtube from "./platforms/youtube";
import * as ytVideos from "./platforms/youtube-videos";
import * as coach from "./platforms/youtube-coach";
import * as apify from "./platforms/apify";
import * as apifyBilling from "./platforms/apify-billing";
import * as rosterYt from "./platforms/roster-yt";
import * as tiktokLikes from "./platforms/tiktok-likes";
import * as skool from "./platforms/skool";
import * as site from "./platforms/site-analytics";
import * as weather from "./platforms/weather";
import * as trading from "./platforms/trading";

// The scheduler is the ONLY code that makes external API calls. It writes to the
// in-memory cache (+ SQLite snapshots); API routes only read the cache.
//
// A single master tick runs every MASTER_TICK_MS. Each source fetches when it's
// "due": either its last success is older than its interval, OR it has never
// succeeded / is currently in error (so a transient boot-time failure retries
// within ~1 minute instead of waiting a full 4h interval). Backoff still applies
// via cache.canFetch().

const MASTER_TICK_MS = 60_000;

const g = globalThis as unknown as { __dashSchedulerStarted?: boolean };
const timers: NodeJS.Timeout[] = [];

function classify(err: unknown): { status: Exclude<FetchStatus, "ok" | "not_configured">; message: string } {
  const message = err instanceof Error ? err.message : String(err);
  const status = err instanceof HttpError && err.rateLimited ? "rate_limited" : "error";
  return { status, message };
}

function fail(key: string, err: unknown) {
  const { status, message } = classify(err);
  cache.setError(key, status, message);
  logFetch(key, status, message);
  console.error(`[scheduler] ${key} failed: ${message}`);
}

/** Due for a fetch? Respects cadence on success; retries promptly on error. */
function due(key: string, intervalMs: number): boolean {
  if (!cache.canFetch(key)) return false; // backoff window still open
  const e = cache.getEntry(key);
  if (e.status === "ok" && e.fetchedAt) return Date.now() - e.fetchedAt >= intervalMs;
  return true; // never succeeded, or in error → attempt now
}

/** Mark a successful fetch: cache + snapshot + an informative log line. */
function ok(key: string, values: Record<string, number>) {
  cache.setOk(key, values);
  insertSnapshots(key, values);
  logFetch(key, "ok", undefined, summarize(key, values));
}

async function tickYouTube() {
  const key = "youtube";
  if (!youtube.isConfigured()) return cache.setNotConfigured(key);
  if (!due(key, INTERVALS.youtube)) return;
  try {
    ok(key, await youtube.fetchYouTube());
  } catch (err) {
    fail(key, err);
  }
}

const SOCIAL_KEYS = ["instagram", "tiktok", "twitter"] as const;

// Adding a profile to the roster shouldn't leave its row blank until the daily
// scrape comes round again, so the first tick after a restart is allowed to run
// early when some target has never produced a value. Once-per-process only: a
// permanently unscrapable handle must not re-trigger a paid run every minute.
let apifyBackfillUsed = false;

// One paid run covers every configured profile — the owner's IG/TikTok/X plus
// the channel roster's IG/TikTok handles. apify.targets() maps each scraped
// profile back to its own cache key, so each gets its own row, history and log.
async function tickApify() {
  const targets = apify.targets();
  if (!apify.isConfigured() || targets.length === 0) {
    // Mark every row this call would have filled (fall back to the owner's three
    // when there are no targets at all, so those rows still say why they're blank).
    const keys = targets.length ? targets.map((t) => t.cacheKey) : [...SOCIAL_KEYS];
    for (const k of keys) cache.setNotConfigured(k);
    return;
  }
  const backfill =
    !apifyBackfillUsed && targets.some((t) => cache.getEntry(t.cacheKey).fetchedAt == null);
  if (!cache.canFetch("apify")) return; // backoff window still open
  // Single gate for the shared paid call.
  if (!backfill && !due("apify", INTERVALS.apify)) return;
  apifyBackfillUsed = true;
  try {
    const results = await apify.fetchApify();
    for (const t of targets) {
      const value = results[t.resultKey];
      if (typeof value === "number") ok(t.cacheKey, { [t.metric]: value });
      else cache.setError(t.cacheKey, "error", "No data returned for this profile");
    }
    cache.setOk("apify", { ok: 1 });
    logFetch("apify", "ok", undefined, `scrape complete · ${targets.length} profiles`);
  } catch (err) {
    const c = classify(err);
    cache.setError("apify", c.status, c.message);
    for (const t of targets) fail(t.cacheKey, err);
  }
}

// Roster YouTube channels (free API). Rich payload → live store; per-channel
// subs/views also land as DAILY snapshots so each row gets a real trend line and
// the 7d-vs-prior-7d acceleration the "blowing up" flag is built on.
async function tickRoster() {
  const key = "roster";
  if (!rosterYt.isConfigured()) return cache.setNotConfigured(key);
  if (!due(key, INTERVALS.roster)) return;
  try {
    const data = await rosterYt.fetchRosterYt();
    live.setOk(key, data);
    cache.setOk(key, { ok: 1 });
    logFetch(key, "ok", undefined, rosterYt.summarize(data));
    const today = new Date().toISOString().slice(0, 10);
    for (const c of data.channels) {
      recordDailySnapshot(c.key, "views", c.views, today);
      recordDailySnapshot(c.key, "subscribers", c.subscribers, today);
    }
  } catch (err) {
    live.setError(key, err instanceof Error ? err.message : String(err));
    fail(key, err);
  }
}

// TikTok total likes/hearts via a separate paid Apify actor (opt-in).
async function tickTikTokLikes() {
  const key = "tiktok_likes";
  if (!tiktokLikes.isConfigured()) return cache.setNotConfigured(key);
  if (!due(key, INTERVALS.tiktokLikes)) return;
  try {
    ok(key, await tiktokLikes.fetchTikTokLikes());
  } catch (err) {
    fail(key, err);
  }
}

// Skool community member count via a separate paid Apify actor (opt-in).
async function tickSkool() {
  const key = "skool";
  if (!skool.isConfigured()) return cache.setNotConfigured(key);
  if (!due(key, INTERVALS.skool)) return;
  try {
    ok(key, await skool.fetchSkool());
  } catch (err) {
    fail(key, err);
  }
}

// First-party website analytics (visitors, CTA clicks/CTR, bounce) from
// benattanasio.com /api/stats: headline 7d values + daily snapshots.
async function tickSite() {
  const key = "site";
  if (!site.isConfigured()) return cache.setNotConfigured(key);
  if (!due(key, INTERVALS.site)) return;
  try {
    const { values, daily } = await site.fetchSite();
    ok(key, values);
    for (const d of daily) {
      recordDailySnapshot("site", "pageviews", d.pageviews, d.date);
      recordDailySnapshot("site", "visitors", d.visitors, d.date);
      recordDailySnapshot("site", "clicks", d.clicks, d.date);
      recordDailySnapshot("site", "bounce", d.bounce, d.date);
    }
  } catch (err) {
    fail(key, err);
  }
}

async function tickApifyBilling() {
  const key = "apifyBilling";
  if (!apifyBilling.isConfigured()) return cache.setNotConfigured(key);
  if (!due(key, INTERVALS.apifyBilling)) return;
  try {
    ok(key, await apifyBilling.fetchApifyBilling());
  } catch (err) {
    fail(key, err);
  }
}

// Rain forecast (Open-Meteo, free). The rich timeline lives in the live store;
// the numeric cache holds a tiny {ok:1} heartbeat purely so due() honors the 15m
// cadence (same gating trick the shared apify call uses).
async function tickWeather() {
  const key = "weather";
  if (!due(key, INTERVALS.weather)) return;
  try {
    const data = await weather.fetchWeather();
    live.setOk(key, data);
    cache.setOk(key, { ok: 1 });
    logFetch(key, "ok", undefined, weather.summarize(data));
  } catch (err) {
    live.setError(key, err instanceof Error ? err.message : String(err));
    fail(key, err);
  }
}

// Recent uploads with per-video stats (rich source → live store + heartbeat).
// Also persists each video's view count as a daily snapshot so per-video
// trajectories can be charted later.
async function tickYtVideos() {
  const key = "ytvideos";
  if (!ytVideos.isConfigured()) return cache.setNotConfigured(key);
  if (!due(key, INTERVALS.ytVideos)) return;
  try {
    const data = await ytVideos.fetchYtVideos();
    live.setOk(key, data);
    cache.setOk(key, { ok: 1 });
    logFetch(key, "ok", undefined, ytVideos.summarize(data));
    const today = new Date().toISOString().slice(0, 10);
    for (const v of data.videos) recordDailySnapshot("ytvideo", v.id, v.views, today);
  } catch (err) {
    live.setError(key, err instanceof Error ? err.message : String(err));
    fail(key, err);
  }
}

// AI coach: Claude (Sonnet) reads the recent-video stats + the creator's own
// content guidelines and returns working/avoid patterns. Waits until the video
// list exists; the 12h cadence keeps cost at pennies.
async function tickCoach() {
  const key = "coach";
  if (!coach.isConfigured()) return cache.setNotConfigured(key);
  if (!due(key, INTERVALS.coach)) return;
  const videos = live.get<ytVideos.YtVideosData>("ytvideos").data?.videos;
  if (!videos || videos.length === 0) return; // retry next master tick once videos land
  try {
    const data = await coach.runCoach(videos);
    live.setOk(key, data);
    cache.setOk(key, { ok: 1 });
    logFetch(key, "ok", undefined, data.headline);
  } catch (err) {
    live.setError(key, err instanceof Error ? err.message : String(err));
    fail(key, err);
  }
}

// AI Trader summary (localhost, keyless). Rich payload → live store, {ok:1}
// heartbeat for the 1m cadence. High-frequency, so it logs on CHANGE only:
// the summary line is compared to the last one written and errors always log.
let lastTradingSummary: string | null = null;
async function tickTrading() {
  const key = "trading";
  if (!trading.isConfigured()) return cache.setNotConfigured(key);
  if (!due(key, INTERVALS.trading)) return;
  try {
    const data = await trading.fetchTrading();
    live.setOk(key, data);
    cache.setOk(key, { ok: 1 });
    const summary = trading.summarize(data);
    if (summary !== lastTradingSummary) {
      lastTradingSummary = summary;
      logFetch(key, "ok", undefined, summary);
    }
  } catch (err) {
    lastTradingSummary = null;
    live.setError(key, err instanceof Error ? err.message : String(err));
    fail(key, err);
  }
}

function masterTick() {
  void tickYouTube();
  void tickYtVideos();
  void tickCoach();
  void tickRoster();
  void tickApify();
  void tickTikTokLikes();
  void tickSkool();
  void tickSite();
  void tickApifyBilling();
  void tickWeather();
  void tickTrading();
}

/** Warm the cache from the last DB snapshots so a restart shows data instantly
 *  and doesn't trigger a needless paid Apify run if the last scrape is recent. */
function warmFromDb() {
  const latest = getLatestByPlatform();
  // Every row the shared paid scrape fills — owner socials + roster IG/TikTok.
  const scraped = new Set(apify.targets().map((t) => t.cacheKey));
  let apifyMax = 0;
  for (const [key, e] of Object.entries(latest)) {
    // The coach is the one source whose PAYLOAD is in-memory only (live-store)
    // while its cadence gate is cached in SQLite. Seeding it means a restart
    // restores "ran recently" without restoring the verdict, so due() suppresses
    // the re-run and the tile reads "First analysis pending…" for up to 12h
    // after every deploy. Let it re-run instead — it costs pennies.
    if (key === "coach") continue;
    cache.seedOk(key, e.values, e.fetchedAt);
    if (scraped.has(key)) apifyMax = Math.max(apifyMax, e.fetchedAt);
  }
  // Seed the shared apify gate so its cadence survives a restart (a reboot must
  // never trigger an unnecessary paid run).
  if (apifyMax > 0) cache.seedOk("apify", { ok: 1 }, apifyMax);
}

export function startScheduler() {
  if (g.__dashSchedulerStarted) return;
  g.__dashSchedulerStarted = true;

  warmFromDb();

  // First run delayed a few seconds so the network is up (avoids boot-time
  // "fetch failed" on the first DNS/TLS call right after the Pi reboots).
  setTimeout(masterTick, 4000);
  timers.push(setInterval(masterTick, MASTER_TICK_MS));

  // Daily retention cleanup.
  cleanupOldData();
  timers.push(setInterval(() => cleanupOldData(), 24 * 60 * 60 * 1000));

  console.log("[scheduler] started");
}
