// Pure, client-safe formatting helpers.

/** 1234 → "1.2K", 3_300_000 → "3.3M". */
export function compact(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, "") + "M";
  if (abs >= 1_000) return (n / 1_000).toFixed(1).replace(/\.0$/, "") + "K";
  return String(Math.round(n));
}

/** Full number with thousands separators, e.g. 2591 → "2,591". */
export function full(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return Math.round(n).toLocaleString("en-US");
}

/** Whole-number currency, e.g. 4820 → "$4,820". */
export function currency(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return "$" + Math.round(n).toLocaleString("en-US");
}

/** Signed delta string for display, e.g. +120 / -45. */
export function signed(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n) || n === 0) return n === 0 ? "±0" : "";
  return (n > 0 ? "+" : "") + compact(n);
}

export function deltaClass(n: number | null | undefined): string {
  if (n == null || n === 0) return "delta-flat";
  return n > 0 ? "delta-up" : "delta-down";
}

/** epoch ms → "5m ago" / "2h ago". */
export function ago(ms: number | null | undefined): string {
  if (!ms) return "never";
  const secs = Math.floor((Date.now() - ms) / 1000);
  if (secs < 60) return `${secs}s ago`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

/** Is this entry stale enough to dim? (older than `staleMs`) */
export function isStale(fetchedAt: number | null | undefined, staleMs: number): boolean {
  if (!fetchedAt) return true;
  return Date.now() - fetchedAt > staleMs;
}
