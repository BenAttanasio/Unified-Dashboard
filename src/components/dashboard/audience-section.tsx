"use client";
import { useMetrics } from "@/hooks/use-metrics";
import { compact, signed, deltaClass, isStale } from "@/lib/format";

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

export function AudienceSection() {
  const { data } = useMetrics();
  const rows = data?.social ?? [];

  return (
    <section className="section area-audience">
      <div className="section-title section-title-row">
        <span>Audience</span>
        <ApifyCost cost={data?.apify?.costUsd} limit={data?.apify?.limitUsd} />
      </div>
      <div className="platform-list">
        {rows.map((p) => {
          const nc = p.status === "not_configured";
          const stale = !nc && isStale(p.fetchedAt, 6 * 60 * 60_000); // >6h old
          return (
            <div key={p.key} className={`platform-row${stale ? " is-stale" : ""}`}>
              <span className="platform-name" style={{ gridColumn: "1 / 3" }}>
                {p.label}
              </span>
              {nc ? (
                <span className="not-configured" style={{ gridColumn: "3 / 5", textAlign: "right" }}>
                  Not configured
                </span>
              ) : (
                <>
                  <span className="platform-count">{compact(p.count)}</span>
                  <span className={`platform-delta ${deltaClass(p.delta)}`}>{signed(p.delta)}</span>
                </>
              )}
            </div>
          );
        })}
        {rows.length === 0 ? <span className="not-configured">Loading…</span> : null}
      </div>
    </section>
  );
}
