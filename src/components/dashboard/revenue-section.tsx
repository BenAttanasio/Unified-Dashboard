"use client";
import { useMetrics } from "@/hooks/use-metrics";
import { MetricChart } from "./metric-chart";
import { currency, full, isStale } from "@/lib/format";

export function RevenueSection() {
  const { data } = useMetrics();
  const r = data?.revenue;
  const nc = r?.status === "not_configured";
  const stale = !nc && isStale(r?.fetchedAt, 15 * 60_000);

  return (
    <section className="section area-revenue">
      <div className="section-title">Revenue</div>
      <MetricChart
        platform="stripe"
        metric="mrr"
        label="MRR"
        value={currency(r?.mrr ?? null)}
        delta={r?.mrrDelta}
        notConfigured={nc}
        stale={stale}
      />
      <MetricChart
        platform="stripe"
        metric="revenue30d"
        label="Revenue (30d)"
        value={currency(r?.revenue30d ?? null)}
        delta={r?.revenue30dDelta}
        notConfigured={nc}
        stale={stale}
      />
      <MetricChart
        platform="stripe"
        metric="customers"
        label="Customers"
        value={r?.customers != null ? full(r.customers) : "—"}
        color="var(--accent)"
        notConfigured={nc}
        stale={stale}
      />
      <MetricChart
        platform="stripe"
        metric="conversions"
        label="Conversions (30d)"
        value={r?.conversions != null ? full(r.conversions) : "—"}
        color="var(--accent)"
        notConfigured={nc}
        stale={stale}
      />
    </section>
  );
}
