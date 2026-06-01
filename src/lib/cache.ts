import { BACKOFF_MS, type FetchStatus, type MetricValues } from "./constants";

export interface CacheEntry {
  /** Last known good values (kept even while a later fetch errors). */
  values: MetricValues | null;
  status: FetchStatus;
  /** epoch ms of the last successful fetch, or null if never. */
  fetchedAt: number | null;
  error?: string;
  /** Consecutive failure count, drives exponential backoff. */
  failCount: number;
  /** Don't attempt another fetch before this epoch ms. */
  nextAllowedAt: number;
}

// Backed by globalThis so the scheduler (instrumentation bundle) and the API
// route handlers share ONE cache instance, even if Next bundles them separately.
const g = globalThis as unknown as { __dashCache?: Map<string, CacheEntry> };
const store: Map<string, CacheEntry> = g.__dashCache ?? (g.__dashCache = new Map());

function ensure(key: string): CacheEntry {
  let entry = store.get(key);
  if (!entry) {
    entry = { values: null, status: "not_configured", fetchedAt: null, failCount: 0, nextAllowedAt: 0 };
    store.set(key, entry);
  }
  return entry;
}

export function getEntry(key: string): CacheEntry {
  return ensure(key);
}

export function getAllEntries(): Record<string, CacheEntry> {
  return Object.fromEntries(store.entries());
}

/** True if backoff has elapsed and we're allowed to fetch again. */
export function canFetch(key: string): boolean {
  return Date.now() >= ensure(key).nextAllowedAt;
}

export function setOk(key: string, values: MetricValues) {
  const entry = ensure(key);
  entry.values = values;
  entry.status = "ok";
  entry.fetchedAt = Date.now();
  entry.error = undefined;
  entry.failCount = 0;
  entry.nextAllowedAt = 0;
}

/** Seed an entry from persisted data on boot. Won't clobber fresher live data. */
export function seedOk(key: string, values: MetricValues, fetchedAt: number) {
  const entry = ensure(key);
  if (entry.status === "ok") return;
  entry.values = values;
  entry.status = "ok";
  entry.fetchedAt = fetchedAt;
  entry.error = undefined;
  entry.failCount = 0;
  entry.nextAllowedAt = 0;
}

export function setNotConfigured(key: string) {
  const entry = ensure(key);
  entry.status = "not_configured";
  // Don't retry configuration-less platforms aggressively.
  entry.nextAllowedAt = Date.now() + 60 * 60 * 1000;
}

export function setError(key: string, status: Exclude<FetchStatus, "ok" | "not_configured">, error: string) {
  const entry = ensure(key);
  entry.status = status; // keep last-good `values` for the dimmed UI
  entry.error = error;
  entry.failCount += 1;
  const backoff = BACKOFF_MS[Math.min(entry.failCount - 1, BACKOFF_MS.length - 1)];
  entry.nextAllowedAt = Date.now() + backoff;
}
