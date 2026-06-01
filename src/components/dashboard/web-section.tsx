"use client";
import { useMetrics } from "@/hooks/use-metrics";
import { BigMetric } from "./metric-card";
import { compact, isStale } from "@/lib/format";

export function WebSection() {
  const { data } = useMetrics();
  const w = data?.web;
  const nc = w?.status === "not_configured";
  const stale = !nc && isStale(w?.fetchedAt, 30 * 60_000);

  return (
    <section className="section area-web">
      <div className="section-title">{process.env.NEXT_PUBLIC_SITE_NAME || "Website"}</div>
      <BigMetric label="Views (7d)" value={compact(w?.views7d ?? null)} notConfigured={nc} stale={stale} />
      <BigMetric label="Visitors (7d)" value={compact(w?.visitors7d ?? null)} notConfigured={nc} stale={stale} />
    </section>
  );
}
