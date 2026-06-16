"use client";
import { useState } from "react";
import { useMetrics } from "@/hooks/use-metrics";
import { useHistory } from "@/hooks/use-history";
import { full, isStale, trendDirection, trendColor } from "@/lib/format";
import { Sparkline } from "./sparkline";
import { DetailSheet } from "./detail-sheet";

// benattanasio.com first-party CTA analytics. The "Join AI Builder Society" CTA is
// tracked per placement on the site; this section surfaces the 7-day funnel
// (visitors → views → clicks, with CTR / conversion / bounce) and a per-placement
// breakdown that opens in a popup.

const PALETTE = ["var(--accent)", "var(--info)", "#b07cff", "var(--warn)", "#3fb1c4", "var(--primary)", "var(--muted)"];

function pct(x: number | null | undefined): string {
  if (x == null || !Number.isFinite(x)) return "—";
  return (x * 100).toFixed(1) + "%";
}

/** "article_cta" → "article cta" for display. */
function prettyLoc(k: string): string {
  return k.replace(/_/g, " ");
}

export function SiteSection() {
  const { data } = useMetrics();
  const s = data?.site;
  const nc = s?.status === "not_configured" || s == null;
  const stale = !nc && isStale(s?.fetchedAt, 30 * 60_000);
  const [open, setOpen] = useState(false);

  // Daily CTA-clicks sparkline (persisted under platform "site", metric "clicks").
  const { data: clicksHist } = useHistory("site", "clicks", 30, !nc);
  const points = clicksHist?.points ?? [];
  const clicksDir = trendDirection(points);

  const byLoc = s?.clicksByLocation ?? {};
  const entries = Object.entries(byLoc).sort((a, b) => b[1] - a[1]);
  const total = entries.reduce((sum, [, n]) => sum + n, 0);

  return (
    <section className={`section area-site${stale ? " is-stale" : ""}`}>
      <div className="section-title">
        benattanasio.com <span className="section-caption">CTA clickthrough · 7-day</span>
      </div>

      {nc ? (
        <span className="not-configured">Not configured</span>
      ) : (
        <>
          <div className="tile-row">
            <div className="tile">
              <span className="tile-label">Visitors</span>
              <span className="tile-value">{full(s?.visitors7d ?? null)}</span>
            </div>
            <div className="tile">
              <span className="tile-label">Views</span>
              <span className="tile-value">{full(s?.pageviews7d ?? null)}</span>
            </div>
            <div className="tile">
              <span className="tile-label">Clicks</span>
              <span className="tile-value">{full(s?.clicks7d ?? null)}</span>
            </div>
          </div>

          <div className="site-pcts">
            <span>
              <span className="site-pct-label">CTR</span>
              <strong>{pct(s?.ctr)}</strong>
            </span>
            <span>
              <span className="site-pct-label">Conversion</span>
              <strong>{pct(s?.conversion)}</strong>
            </span>
            <span>
              <span className="site-pct-label">Bounce</span>
              <strong>{pct(s?.bounce)}</strong>
            </span>
          </div>

          {total > 0 ? (
            <button className="site-bar-btn tappable" onClick={() => setOpen(true)} aria-label="CTA clicks by button placement">
              <span className="site-bar-head">
                <span className="chart-label">Clicks by button</span>
                <span className="site-bar-cta">tap for breakdown ▸</span>
              </span>
              <span className="site-bar">
                {entries.map(([loc, n], i) => (
                  <span
                    key={loc}
                    className="site-seg"
                    title={`${prettyLoc(loc)}: ${n}`}
                    style={{ width: `${(n / total) * 100}%`, background: PALETTE[i % PALETTE.length] }}
                  />
                ))}
              </span>
            </button>
          ) : null}

          <div className="chart-label site-spark-label">Daily clicks · 30d</div>
          <div className="site-spark">
            <Sparkline points={points} color={trendColor(clicksDir)} ariaLabel="CTA clicks over 30 days" />
          </div>
        </>
      )}

      <DetailSheet open={open} onClose={() => setOpen(false)} title="CTA clicks by button" badge={`${total} clicks · 7-day total`}>
        <div className="detail-list">
          {entries.length === 0 ? (
            <div className="log-empty">No clicks recorded yet.</div>
          ) : (
            entries.map(([loc, n], i) => (
              <div className="detail-row" key={loc}>
                <span className="detail-label">
                  <span className="site-dot" style={{ background: PALETTE[i % PALETTE.length] }} />
                  {prettyLoc(loc)}
                </span>
                <span className="detail-value">
                  {full(n)} <span className="site-share">{total > 0 ? Math.round((n / total) * 100) : 0}%</span>
                </span>
              </div>
            ))
          )}
        </div>
      </DetailSheet>
    </section>
  );
}
