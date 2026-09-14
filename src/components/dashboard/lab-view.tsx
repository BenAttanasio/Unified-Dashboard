"use client";

import { useLab } from "@/hooks/use-lab";
import { Sparkline } from "@/components/dashboard/sparkline";
import { ago, full, numberColor, trendColor, trendDirection } from "@/lib/format";
import type { LabRow } from "@/services/platforms/site-analytics";

/**
 * The Lab tab: who is looking at /lab, which project tiles they actually click
 * through to, and whether anyone plays Iron Dunes.
 *
 * It has no source of its own. tickSite already polls benattanasio.com
 * /api/stats every 5 minutes for the numeric site metrics, and the same response
 * carries the three breakdown maps this is built from (pages / outbound links /
 * game events); the scheduler drops them in the live store for /api/lab.
 *
 * Color grammar matches the rest of the app: headline numbers are neutral and
 * turn red only when the metric is down over the period charted; the bars behind
 * the rows are a flat neutral, because "most clicked" is not "good" or "bad".
 */

const GAME_PAGE = "lab_iron-dunes";
const GAME_TILE = "iron-dunes-rogue-battalions";

/** A ranked row with a proportional bar behind it. */
function BarRow({ row, max, unit }: { row: LabRow; max: number; unit: string }) {
  const pct = max > 0 ? Math.max(2, (row.d7 / max) * 100) : 0;
  return (
    <div className="lab-row" title={`${row.label} · ${row.d7} ${unit} in 7d · ${row.d30} in 30d`}>
      <span className="lab-row-bar" style={{ width: `${pct}%` }} aria-hidden />
      <span className="lab-row-name">{row.label}</span>
      <span className="lab-row-n">{full(row.d7)}</span>
      <span className="lab-row-n30">{full(row.d30)}</span>
    </div>
  );
}

function Panel({
  title,
  rows,
  unit,
  empty,
}: {
  title: string;
  rows: LabRow[];
  unit: string;
  empty: string;
}) {
  const shown = rows.filter((r) => r.d30 > 0);
  const max = shown.length ? Math.max(...shown.map((r) => r.d7)) : 0;
  return (
    <div className="perf-panel">
      <div className="perf-panel-title lab-panel-title">
        <span>{title}</span>
        <span className="lab-col-key">7d · 30d</span>
      </div>
      <div className="perf-panel-body">
        {shown.length === 0 ? (
          <div className="perf-empty">{empty}</div>
        ) : (
          shown.map((r) => <BarRow key={r.slug} row={r} max={max} unit={unit} />)
        )}
      </div>
    </div>
  );
}

function Kpi({ value, label, hint, color }: { value: string; label: string; hint?: string; color?: string }) {
  return (
    <div className="trading-kpi">
      <span className="trading-kpi-value" style={color ? { color } : undefined}>{value}</span>
      <span className="chart-label">{label}</span>
      {hint && <span className="chart-hint">{hint}</span>}
    </div>
  );
}

/** One step of the Iron Dunes funnel, as a share of the step that feeds it. */
function FunnelStep({ label, n, of, hint }: { label: string; n: number; of: number; hint: string }) {
  const pct = of > 0 ? Math.round((n / of) * 100) : 0;
  return (
    <div className="lab-funnel-step" title={`${n} of ${of} — ${hint}`}>
      <span className="lab-funnel-bar" style={{ width: `${of > 0 ? Math.max(2, pct) : 0}%` }} aria-hidden />
      <span className="lab-funnel-name">{label}</span>
      <span className="lab-funnel-n">{full(n)}</span>
      <span className="lab-funnel-pct">{of > 0 ? `${pct}%` : "—"}</span>
    </div>
  );
}

export function LabView() {
  const { data, isLoading } = useLab();

  if (isLoading && !data) return <div className="perf-wrap perf-empty">loading…</div>;
  if (!data || data.status === "not_configured") {
    return (
      <div className="perf-wrap">
        <div className="perf-empty">
          Lab view is off — set SITE_STATS_URL (and SITE_STATS_TOKEN) to benattanasio.com&apos;s /api/stats.
        </div>
      </div>
    );
  }

  const stale = data.status !== "ok";
  const pages = data.pages ?? [];
  const outbound = data.outbound ?? [];
  const ev = data.events ?? {};
  const ev30 = data.events30 ?? {};
  const daily = data.daily ?? [];

  const labViews = pages.find((p) => p.slug === "lab");
  const gamePage = pages.find((p) => p.slug === GAME_PAGE);
  const gameTile = outbound.find((o) => o.slug === GAME_TILE);
  const tileClicks7 = outbound.reduce((n, r) => n + r.d7, 0);
  const tileClicks30 = outbound.reduce((n, r) => n + r.d30, 0);
  const clickedProjects = outbound.filter((r) => r.d7 > 0).length;

  // Lab pageviews → tile clicks is the question the tab exists to answer, so the
  // headline is the rate, not either number on its own.
  const throughRate = labViews?.d7 ? Math.round((tileClicks7 / labViews.d7) * 100) : 0;

  const series = daily.map((d) => ({ value: d.labViews, recorded_at: d.date }));
  const dir = trendDirection(series);
  const plays = ev.game_start ?? 0;
  const blocked = (ev.game_nowebgl ?? 0) + (ev.game_nokbd ?? 0);

  return (
    <div className={`perf-wrap lab-wrap${stale ? " is-stale" : ""}`}>
      <div className="perf-head">
        <span className="perf-head-title">LAB</span>
        <span className="perf-head-sub">
          benattanasio.com · last 7 days vs 30 · updated {ago(data.fetchedAt)}
          {stale && <span className="trading-badge is-stale">{data.error ? "site unreachable" : "stale"}</span>}
        </span>
      </div>

      <div className="trading-kpis">
        <Kpi
          value={full(labViews?.d7 ?? 0)}
          label="lab views"
          color={numberColor(dir)}
          hint={`${full(labViews?.d30 ?? 0)} in 30d`}
        />
        <Kpi value={full(tileClicks7)} label="tile clicks" hint={`${full(tileClicks30)} in 30d`} />
        <Kpi value={`${throughRate}%`} label="click-through" hint="of lab views open a project" />
        <Kpi value={full(clickedProjects)} label="projects clicked" hint={`of ${outbound.length} ever clicked`} />
        <Kpi value={full(plays)} label="game runs" hint={`${full(ev30.game_start ?? 0)} in 30d`} />
      </div>

      <div className="trading-chart">
        <div className="chart-label">/lab pageviews · {daily.length} days</div>
        <Sparkline
          points={series}
          color={trendColor(dir)}
          className="lab-spark"
          ariaLabel="Lab pageviews over the last 30 days"
        />
      </div>

      <div className="lab-cols">
        <Panel
          title="Pages"
          rows={pages}
          unit="views"
          empty="No pageviews recorded yet. Counting starts from the deploy that added per-page tracking."
        />
        <Panel
          title="Tiles & links clicked"
          rows={outbound}
          unit="clicks"
          empty="Nobody has clicked through to a project yet."
        />

        <div className="perf-panel">
          <div className="perf-panel-title lab-panel-title">
            <span>Iron Dunes</span>
            <span className="lab-col-key">7d · share of step above</span>
          </div>
          <div className="perf-panel-body">
            <FunnelStep
              label="tile clicked"
              n={gameTile?.d7 ?? 0}
              of={labViews?.d7 ?? 0}
              hint="of everyone who opened /lab"
            />
            <FunnelStep
              label="game opened"
              n={gamePage?.d7 ?? 0}
              of={gameTile?.d7 ?? 0}
              hint="tile clicks that reached the page (direct links inflate this)"
            />
            <FunnelStep label="run deployed" n={plays} of={gamePage?.d7 ?? 0} hint="pressed DEPLOY" />
            <FunnelStep label="played 5 min" n={ev.game_5min ?? 0} of={plays} hint="5 minutes of actual gameplay" />
            <FunnelStep label="played 15 min" n={ev.game_15min ?? 0} of={ev.game_5min ?? 0} hint="stayed a while" />
            <div className="lab-funnel-foot">
              <span>{full(ev.game_death ?? 0)} tanks lost</span>
              <span>{full(ev.game_rankup ?? 0)} ranks earned</span>
              <span className={blocked > 0 ? "lab-blocked" : undefined}>
                {full(blocked)} couldn&apos;t play
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
