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

/**
 * Trend direction over the period actually being charted: +1 up, -1 down, 0 flat.
 * Prefers the series (first vs last point) so "down" means down over the chart's
 * own window; falls back to a supplied delta when there's no series yet. This is
 * what drives the red/green coloring — red is shown ONLY when a metric is truly
 * down over the period it measures.
 */
export function trendDirection(
  points: { value: number }[] | null | undefined,
  fallbackDelta?: number | null,
): number {
  if (points && points.length >= 2) {
    const first = points[0].value;
    const last = points[points.length - 1].value;
    return Math.sign(last - first);
  }
  if (fallbackDelta != null && Number.isFinite(fallbackDelta)) return Math.sign(fallbackDelta);
  return 0;
}

/** Headline-number color: red only when down; otherwise neutral white. */
export function numberColor(dir: number): string {
  return dir < 0 ? "var(--crit)" : "var(--text)";
}

/** Chart/sparkline color: red down, green up, muted when flat/unknown. */
export function trendColor(dir: number): string {
  return dir < 0 ? "var(--crit)" : dir > 0 ? "var(--ok)" : "var(--muted)";
}
