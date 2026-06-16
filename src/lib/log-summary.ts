import { compact, currency } from "./format";

// Human-readable one-line summaries of what a fetch returned, written into the
// fetch_logs.summary column so the live log reads like "stripe ok — MRR $13"
// instead of just a status. Pure + client-safe (only uses format helpers).

type Values = Record<string, number> | null | undefined;

export function summarize(platform: string, values: Values): string | undefined {
  if (!values) return undefined;
  const v = (k: string) => values[k];

  switch (platform) {
    case "stripe":
      return `MRR ${currency(v("mrr"))} · 30d ${currency(v("revenue30d"))} · ${v("customers") ?? 0} cust`;
    case "youtube":
      return `${compact(v("subscribers"))} subs · ${compact(v("views"))} views`;
    case "vercel":
      return `${compact(v("views7d"))} views / ${compact(v("visitors7d"))} visitors (7d)`;
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
