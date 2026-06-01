import { NextResponse } from "next/server";
import * as cache from "@/lib/cache";
import { getDelta } from "@/lib/db";
import { SOCIAL_PLATFORMS, SOCIAL_DELTA_MS } from "@/lib/constants";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function num(values: Record<string, number> | null, key: string): number | null {
  if (!values) return null;
  const v = values[key];
  return typeof v === "number" ? v : null;
}

export function GET() {
  // Audience: one row per social platform with headline count + 24h delta.
  const social = SOCIAL_PLATFORMS.map((p) => {
    const entry = cache.getEntry(p.key);
    const count = num(entry.values, p.countMetric);
    return {
      id: p.id ?? `${p.key}:${p.countMetric}`,
      key: p.key,
      label: p.label,
      metric: p.countMetric,
      status: entry.status,
      fetchedAt: entry.fetchedAt,
      count,
      delta: count != null ? getDelta(p.key, p.countMetric, count, SOCIAL_DELTA_MS) : null,
    };
  });

  // Revenue (Stripe).
  const s = cache.getEntry("stripe");
  const mrr = num(s.values, "mrr");
  const revenue30d = num(s.values, "revenue30d");
  const revenue = {
    status: s.status,
    fetchedAt: s.fetchedAt,
    mrr,
    revenue30d,
    customers: num(s.values, "customers"),
    conversions: num(s.values, "conversions"),
    mrrDelta: mrr != null ? getDelta("stripe", "mrr", mrr) : null,
    revenue30dDelta: revenue30d != null ? getDelta("stripe", "revenue30d", revenue30d) : null,
  };

  // Web (Vercel).
  const v = cache.getEntry("vercel");
  const web = {
    status: v.status,
    fetchedAt: v.fetchedAt,
    views7d: num(v.values, "views7d"),
    visitors7d: num(v.values, "visitors7d"),
  };

  // Apify monthly cost tracker.
  const ab = cache.getEntry("apifyBilling");
  const apify = {
    status: ab.status,
    fetchedAt: ab.fetchedAt,
    costUsd: num(ab.values, "costUsd"),
    limitUsd: num(ab.values, "limitUsd"),
  };

  // Subreddit moderator traffic (dormant until Reddit API approval).
  const rt = cache.getEntry("reddit_traffic");
  const subreddit = {
    status: rt.status,
    fetchedAt: rt.fetchedAt,
    weeklyVisitors: num(rt.values, "weekly_visitors"),
    weeklyPageviews: num(rt.values, "weekly_pageviews"),
  };

  return NextResponse.json({ ts: new Date().toISOString(), social, revenue, web, apify, subreddit });
}
