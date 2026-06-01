"use client";
import { useMetrics } from "@/hooks/use-metrics";
import { BigMetric, Tile } from "./metric-card";
import { currency, isStale } from "@/lib/format";

export function RevenueSection() {
  const { data } = useMetrics();
  const r = data?.revenue;
  const nc = r?.status === "not_configured";
  const stale = !nc && isStale(r?.fetchedAt, 15 * 60_000);

  return (
    <section className="section area-revenue">
      <div className="section-title">Revenue</div>
      <BigMetric
        label="MRR"
        value={currency(r?.mrr ?? null)}
        delta={r?.mrrDelta}
        notConfigured={nc}
        stale={stale}
      />
      <BigMetric
        label="Revenue (30d)"
        value={currency(r?.revenue30d ?? null)}
        delta={r?.revenue30dDelta}
        notConfigured={nc}
        stale={stale}
      />
      <div className="tile-row">
        <Tile
          label="Customers"
          value={r?.customers != null ? String(r.customers) : "—"}
          secondary
          notConfigured={nc}
          stale={stale}
        />
        <Tile
          label="Conversions (30d)"
          value={r?.conversions != null ? String(r.conversions) : "—"}
          secondary
          notConfigured={nc}
          stale={stale}
        />
      </div>
    </section>
  );
}
