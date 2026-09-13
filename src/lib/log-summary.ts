import { compact } from "./format";

// Human-readable one-line summaries of what a fetch returned, written into the
// fetch_logs.summary column so the live log reads like "youtube ok — 2.5K subs"
// instead of just a status. Pure + client-safe (only uses format helpers).

type Values = Record<string, number> | null | undefined;

export function summarize(platform: string, values: Values): string | undefined {
  if (!values) return undefined;
  const v = (k: string) => values[k];

  // Channel roster rows (ch_<initials>_ig / _tt) come from the shared Apify
  // scrape and all report a follower count.
  if (platform.startsWith("ch_")) return `${compact(v("followers"))} followers`;

  switch (platform) {
    case "youtube":
      return `${compact(v("subscribers"))} subs · ${compact(v("views"))} views`;
    case "apifyBilling":
      return `$${(v("costUsd") ?? 0).toFixed(2)} / $${v("limitUsd") ?? 0} this month`;
    case "instagram":
    case "tiktok":
    case "twitter":
      return `${compact(v("followers"))} followers`;
    case "tiktok_likes":
      return `${compact(v("likes"))} likes`;
    case "skool":
      return `${compact(v("members"))} members`;
    default:
      return undefined;
  }
}
