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

  return (
    <section className="section area-web">
      <div className="section-title">
        {siteName} · Traffic <span className="section-caption">Vercel</span>
      </div>
      <MetricChart
        platform="vercel"
        metric="views"
        label="Page views"
        hint="last 7 days"
        value={full(w?.views7d ?? null)}
        notConfigured={nc}
        stale={stale}
      />
      <MetricChart
        platform="vercel"
        metric="visitors"
        label="Unique visitors"
        hint="last 7 days"
        value={full(w?.visitors7d ?? null)}
        notConfigured={nc}
        stale={stale}
      />
    </section>
  );
}
