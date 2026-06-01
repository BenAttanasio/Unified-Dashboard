"use client";
import { useMetrics } from "@/hooks/use-metrics";
import { MetricChart } from "./metric-chart";
import { full, isStale } from "@/lib/format";

export function WebSection() {
  const { data } = useMetrics();
  const w = data?.web;
  const nc = w?.status === "not_configured";
  const stale = !nc && isStale(w?.fetchedAt, 30 * 60_000);

  const siteName = process.env.NEXT_PUBLIC_SITE_NAME || "Website";
  const sub = data?.subreddit;
  const subNc = sub?.status === "not_configured" || sub == null;

  return (
    <section className="section area-web">
      <div className="section-title">{siteName}</div>
      <MetricChart
        platform="vercel"
        metric="views"
        label="Views (7d) · daily trend"
        value={full(w?.views7d ?? null)}
        notConfigured={nc}
        stale={stale}
      />
      <MetricChart
        platform="vercel"
        metric="visitors"
        label="Visitors (7d) · daily trend"
        value={full(w?.visitors7d ?? null)}
        color="var(--accent)"
        notConfigured={nc}
        stale={stale}
      />
      <MetricChart
        platform="reddit_traffic"
        metric="weekly_visitors"
        label="Subreddit · weekly visitors"
        value={sub?.weeklyVisitors != null ? full(sub.weeklyVisitors) : "—"}
        color="var(--info)"
        notConfigured={subNc}
        emptyNote="Pending Reddit API approval"
      />
    </section>
  );
}
