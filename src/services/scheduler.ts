import * as cache from "@/lib/cache";
import { insertSnapshots, logFetch, cleanupOldData, getLatestByPlatform } from "@/lib/db";
import { HttpError } from "@/lib/fetcher";
import { INTERVALS, type FetchStatus } from "@/lib/constants";
import * as youtube from "./platforms/youtube";
import * as apify from "./platforms/apify";
import * as apifyBilling from "./platforms/apify-billing";
import * as reddit from "./platforms/reddit";
import * as stripe from "./platforms/stripe";
import * as vercel from "./platforms/vercel";

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

async function tickYouTube() {
  const key = "youtube";
  if (!youtube.isConfigured()) return cache.setNotConfigured(key);
  if (!due(key, INTERVALS.youtube)) return;
  try {
    const values = await youtube.fetchYouTube();
    cache.setOk(key, values);
    insertSnapshots(key, values);
    logFetch(key, "ok");
  } catch (err) {
    fail(key, err);
  }
}

const SOCIAL_KEYS = ["instagram", "tiktok", "twitter"] as const;

async function tickReddit() {
  const key = "reddit";
  if (!reddit.isConfigured()) return cache.setNotConfigured(key);
  if (!due(key, INTERVALS.reddit)) return;
  try {
    const values = await reddit.fetchReddit();
    cache.setOk(key, values);
    insertSnapshots(key, values);
    logFetch(key, "ok");
  } catch (err) {
    fail(key, err);
  }
}

async function tickApify() {
  if (!apify.isConfigured() || !apify.hasProfiles()) {
    for (const k of SOCIAL_KEYS) cache.setNotConfigured(k);
    return;
  }
  if (!due("apify", INTERVALS.apify)) return; // single gate for the shared paid call
  try {
    const results = await apify.fetchApify();
    for (const k of SOCIAL_KEYS) {
      const values = results[k];
      if (values) {
        cache.setOk(k, values);
        insertSnapshots(k, values);
      } else {
        // The actor returned nothing usable for this platform this run.
        cache.setError(k, "error", "No data returned for this platform");
      }
    }
    cache.setOk("apify", { ok: 1 });
    logFetch("apify", "ok");
  } catch (err) {
    const c = classify(err);
    cache.setError("apify", c.status, c.message);
    for (const k of SOCIAL_KEYS) fail(k, err);
  }
}

async function tickStripe() {
  const key = "stripe";
  if (!stripe.isConfigured()) return cache.setNotConfigured(key);
  if (!due(key, INTERVALS.stripe)) return;
  try {
    const values = await stripe.fetchStripe();
    cache.setOk(key, values);
    insertSnapshots(key, values);
    logFetch(key, "ok");
  } catch (err) {
    fail(key, err);
  }
}

async function tickVercel() {
  const key = "vercel";
  if (!vercel.isConfigured()) return cache.setNotConfigured(key);
  if (!due(key, INTERVALS.vercel)) return;
  try {
    const values = await vercel.fetchVercel();
    cache.setOk(key, values);
    insertSnapshots(key, values);
    logFetch(key, "ok");
  } catch (err) {
    fail(key, err);
  }
}

async function tickApifyBilling() {
  const key = "apifyBilling";
  if (!apifyBilling.isConfigured()) return cache.setNotConfigured(key);
  if (!due(key, INTERVALS.apifyBilling)) return;
  try {
    const values = await apifyBilling.fetchApifyBilling();
    cache.setOk(key, values);
    insertSnapshots(key, values);
    logFetch(key, "ok");
  } catch (err) {
    fail(key, err);
  }
}

function masterTick() {
  void tickYouTube();
  void tickApify();
  void tickReddit();
  void tickStripe();
  void tickVercel();
  void tickApifyBilling();
}

/** Warm the cache from the last DB snapshots so a restart shows data instantly
 *  and doesn't trigger a needless paid Apify run if the last scrape is recent. */
function warmFromDb() {
  const latest = getLatestByPlatform();
  let apifyMax = 0;
  for (const [key, e] of Object.entries(latest)) {
    cache.seedOk(key, e.values, e.fetchedAt);
    if ((SOCIAL_KEYS as readonly string[]).includes(key)) apifyMax = Math.max(apifyMax, e.fetchedAt);
  }
  // Seed the shared apify gate so its 4h cadence survives a restart.
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
