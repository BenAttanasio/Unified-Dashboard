"use client";
import { useMetrics } from "@/hooks/use-metrics";
import { MetricChart } from "./metric-chart";
import { currency, full, isStale } from "@/lib/format";

export function RevenueSection() {
  const { data } = useMetrics();
  const r = data?.revenue;
  const nc = r?.status === "not_configured";
  const stale = !nc && isStale(r?.fetchedAt, 15 * 60_000);

  // Inferred signup conversion: paying customers ÷ unique site visitors (7d).
  const customers = r?.customers ?? null;
  const visitors7d = data?.site?.visitors7d ?? null;
  const conv = customers != null && visitors7d != null && visitors7d > 0 ? (customers / visitors7d) * 100 : null;
  const convStr = conv != null ? conv.toFixed(1) + "%" : "—";

  return (
    <section className="section area-revenue">
      <div className="section-title">
        SIFT · Revenue <span className="section-caption">Stripe</span>
      </div>
      <MetricChart
        platform="stripe"
        metric="mrr"
        label="MRR"
        hint="monthly recurring revenue"
        value={currency(r?.mrr ?? null)}
        delta={r?.mrrDelta}
        notConfigured={nc}
        stale={stale}
      />
      <MetricChart
        platform="stripe"
        metric="customers"
        label="Customers"
        hint="active paying subscribers"
        value={customers != null ? full(customers) : "—"}
        notConfigured={nc}
        stale={stale}
      />
      <MetricChart
        platform="stripe"
        metric="signup_conversion"
        label="Signup conversion"
        hint="paying customers ÷ unique site visitors (7d)"
        value={convStr}
        notConfigured={nc}
        stale={stale}
        points={[]}
        emptyNote=""
      />
    </section>
  );
}
