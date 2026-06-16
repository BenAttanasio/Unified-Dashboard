"use client";
import { useMetrics } from "@/hooks/use-metrics";
import { useHistory } from "@/hooks/use-history";
import { full, signed, deltaClass, isStale, trendDirection, trendColor } from "@/lib/format";
import { Sparkline } from "./sparkline";
import type { SocialMetric } from "@/lib/types";

function ApifyCost({ cost, limit }: { cost: number | null | undefined; limit: number | null | undefined }) {
  if (cost == null) return null;
  const cap = limit ?? 5;
  const pct = cap > 0 ? cost / cap : 0;
  const cls = pct >= 0.9 ? "delta-down" : pct >= 0.6 ? "stale-tag" : "delta-up";
  return (
    <span className={`apify-cost ${cls}`} title="Apify usage this billing month">
      Apify ${cost.toFixed(2)} / ${cap}
    </span>
  );
}

function PlatformRow({ p }: { p: SocialMetric }) {
  const nc = p.status === "not_configured";
  const stale = !nc && isStale(p.fetchedAt, 6 * 60 * 60_000); // >6h old
  const { data } = useHistory(p.key, p.metric, 30, !nc);
  const points = data?.points ?? [];
  const dir = trendDirection(points, p.delta);

  return (
    <div className={`platform-row${stale ? " is-stale" : ""}`}>
      <div className="platform-head">
        <span className="platform-name">{p.label}</span>
        {nc ? (
          <span className="not-configured">Not configured</span>
        ) : (
          <span className="platform-figures">
            <span className="platform-count">{full(p.count)}</span>
            {p.delta != null && p.delta !== 0 ? (
              <span className={`platform-delta ${deltaClass(p.delta)}`}>{signed(p.delta)}</span>
            ) : null}
          </span>
        )}
      </div>
      {!nc ? (
        <div className="platform-spark">
          <Sparkline points={points} color={trendColor(dir)} ariaLabel={`${p.label} trend`} />
        </div>
      ) : null}
    </div>
  );
}

export function AudienceSection() {
  const { data } = useMetrics();
  const rows = data?.social ?? [];

  return (
    <section className="section area-audience">
      <div className="section-title section-title-row">
        <span>
          Audience <span className="section-caption">30-day trend · Δ vs 30d ago</span>
        </span>
        <ApifyCost cost={data?.apify?.costUsd} limit={data?.apify?.limitUsd} />
      </div>
      <div className="platform-list">
        {rows.map((p) => (
          <PlatformRow key={p.id} p={p} />
        ))}
        {rows.length === 0 ? <span className="not-configured">Loading…</span> : null}
      </div>
    </section>
  );
}
