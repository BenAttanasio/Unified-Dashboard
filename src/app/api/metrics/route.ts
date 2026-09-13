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
      hint: p.hint,
      // The charted series can differ from the headline (benattanasio.com shows
      // a 7-day visitor rollup but charts the daily series behind it).
      metric: p.chartMetric ?? p.countMetric,
      status: entry.status,
      fetchedAt: entry.fetchedAt,
      count,
      delta: count != null ? getDelta(p.key, p.countMetric, count, SOCIAL_DELTA_MS) : null,
    };
  });

  // benattanasio.com is one of those rows now (SOCIAL_PLATFORMS "site"): traffic
  // is low enough that the CTA funnel didn't earn a module of its own. The
  // scheduler still records the full funnel to SQLite, so it can come back.

  // Apify monthly cost tracker.
  const ab = cache.getEntry("apifyBilling");
  const apify = {
    status: ab.status,
    fetchedAt: ab.fetchedAt,
    costUsd: num(ab.values, "costUsd"),
    limitUsd: num(ab.values, "limitUsd"),
  };

  return NextResponse.json({ ts: new Date().toISOString(), social, apify });
}
