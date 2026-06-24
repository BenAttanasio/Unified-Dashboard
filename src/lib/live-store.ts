import type { FetchStatus } from "./constants";

// A parallel store to cache.ts for sources whose payload is a rich object/timeline
// (e.g. the weather forecast) rather than a bag of numbers. It mirrors
// the cache's { status, fetchedAt } convention so API routes read it identically,
// but holds arbitrary JSON instead of MetricValues. Like the numeric cache it's
// backed by globalThis so the scheduler (instrumentation bundle) and the route
// handlers share ONE instance even when Next bundles them separately.

export interface LiveEntry<T = unknown> {
  status: FetchStatus;
  /** epoch ms of the last successful fetch, or null if never. */
  fetchedAt: number | null;
  error?: string;
  data: T | null;
}

const g = globalThis as unknown as { __dashLive?: Map<string, LiveEntry> };
const store: Map<string, LiveEntry> = g.__dashLive ?? (g.__dashLive = new Map());

const EMPTY: LiveEntry = { status: "not_configured", fetchedAt: null, data: null };

export function get<T>(key: string): LiveEntry<T> {
  return (store.get(key) as LiveEntry<T>) ?? (EMPTY as LiveEntry<T>);
}

export function setOk<T>(key: string, data: T) {
  store.set(key, { status: "ok", fetchedAt: Date.now(), error: undefined, data });
}

/** Record an error but keep the last-good payload/fetchedAt for a dimmed UI. */
export function setError(key: string, error: string) {
  const prev = store.get(key);
  store.set(key, {
    status: "error",
    fetchedAt: prev?.fetchedAt ?? null,
    error,
    data: prev?.data ?? null,
  });
}
