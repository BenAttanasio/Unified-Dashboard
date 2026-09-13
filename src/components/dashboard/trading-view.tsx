"use client";

import { useTrading } from "@/hooks/use-trading";
import { ago, currency, numberColor, trendColor, trendDirection } from "@/lib/format";
import type { TradingAction, TradingPosition } from "@/services/platforms/trading";

/**
 * The trading tab: a read-only view of the AI Trader's /api/summary, sized for
 * the 1280x800 kiosk. Big numbers, one sparkline, two short lists. The full
 * dashboard (thesis cards, journal, activity stream) lives in the bot's own UI.
 *
 * Color grammar follows the rest of this app: headline numbers are neutral and
 * turn red only when the metric is down; coral is reserved for badges.
 */

function signedCurrency(n: number | null | undefined, digits = 0): string {
  if (n == null || !Number.isFinite(n)) return "—";
  const s = n < 0 ? "-" : "+";
  return `${s}$${Math.abs(n).toLocaleString("en-US", { maximumFractionDigits: digits })}`;
}

function pct(n: number | null | undefined, digits = 2): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return `${n < 0 ? "" : "+"}${n.toFixed(digits)}%`;
}

function Spark({ points, color }: { points: number[]; color: string }) {
  const vals = points.filter((p) => Number.isFinite(p));
  if (vals.length < 2) return <div className="perf-spark perf-spark-empty">no series yet</div>;
  const w = 100, h = 24, max = Math.max(...vals), min = Math.min(...vals);
  const span = max - min || 1;
  const d = vals
    .map((v, i) => `${(i / (vals.length - 1)) * w},${h - ((v - min) / span) * (h - 4) - 2}`)
    .join(" ");
  return (
    <svg className="perf-spark trading-spark" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" aria-hidden>
      <polyline points={d} fill="none" stroke={color} strokeWidth="2"
        vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

function Kpi({ value, label, color, hint }: { value: string; label: string; color?: string; hint?: string }) {
  return (
    <div className="trading-kpi">
      <span className="trading-kpi-value" style={color ? { color } : undefined}>{value}</span>
      <span className="chart-label">{label}</span>
      {hint && <span className="chart-hint">{hint}</span>}
    </div>
  );
}

function PositionRow({ p }: { p: TradingPosition }) {
  const down = p.plPercent < 0;
  return (
    <div className="trading-row" title={p.thesis ?? undefined}>
      <span className="trading-row-sym">{p.symbol}</span>
      <span className="trading-row-val">{currency(p.marketValue)}</span>
      <span className="trading-row-pl" style={{ color: down ? "var(--crit)" : "var(--text)" }}>{pct(p.plPercent, 1)}</span>
      <span className="trading-row-meta">{p.daysHeld}d</span>
    </div>
  );
}

function ActionRow({ a }: { a: TradingAction }) {
  const when = ago(new Date(a.createdAt).getTime());
  return (
    <div className="trading-row trading-action" title={a.reasoning}>
      <span className={`trading-badge ${a.action === "BUY" ? "is-buy" : "is-sell"}`}>{a.action}</span>
      <span className="trading-row-sym">{a.symbol}</span>
      <span className="trading-row-val">{currency(a.notional)}</span>
      <span className="trading-row-meta">{a.trigger.replace(/_/g, " ")} · {when}</span>
    </div>
  );
}

export function TradingView() {
  const { data, isLoading } = useTrading();

  if (isLoading && !data) return <div className="perf-wrap perf-empty">loading…</div>;
  if (!data || data.status === "not_configured") {
    return (
      <div className="perf-wrap">
        <div className="perf-empty">Trading view is off — set TRADING_BOT_URL to the AI Trader's base URL.</div>
      </div>
    );
  }

  const stale = data.status !== "ok";
  const curve = (data.equityCurve ?? []).map((p) => ({ value: p.value }));
  const dir = trendDirection(curve, data.dailyPL);
  const dayDir = Math.sign(data.dailyPL ?? 0);
  const totalDir = Math.sign(data.totalPL ?? 0);
  const positions = [...(data.positions ?? [])].sort((a, b) => b.marketValue - a.marketValue).slice(0, 8);
  const actions = (data.recentActions ?? []).slice(0, 5);
  const modeLabel = data.mode === "live" ? "LIVE MONEY" : "PAPER";

  return (
    <div className={`perf-wrap trading-wrap${stale ? " is-stale" : ""}`}>
      <div className="perf-head">
        <span className="perf-head-title">TRADING</span>
        <span className="perf-head-sub">
          {modeLabel} · {(data.marketState ?? "").replace("_", " ")} · updated {ago(data.fetchedAt)}
          {data.paused && <span className="trading-badge is-paused">PAUSED</span>}
          {stale && <span className="trading-badge is-stale">{data.error ? "bot unreachable" : "stale"}</span>}
        </span>
      </div>

      <div className="trading-kpis">
        <Kpi value={currency(data.equity)} label="equity" hint={data.startingEquity ? `started at ${currency(data.startingEquity)}` : undefined} />
        <Kpi value={signedCurrency(data.dailyPL)} label="today" color={numberColor(dayDir)} hint={pct(data.dailyPLPercent)} />
        <Kpi value={signedCurrency(data.totalPL)} label="since start" color={numberColor(totalDir)} hint={pct(data.totalPLPercent)} />
        <Kpi value={String(data.positionCount ?? 0)} label="positions" hint={`${currency(data.invested)} deployed`} />
        <Kpi value={`${data.todayStats?.tradesExecuted ?? 0} / ${data.todayStats?.tradesBlocked ?? 0}`} label="trades / blocked" hint={data.nextPulse?.label} />
      </div>

      <div className="trading-chart">
        <div className="chart-label">equity · {curve.length} sessions</div>
        <Spark points={curve.map((c) => c.value)} color={trendColor(dir)} />
      </div>

      <div className="trading-cols">
        <div className="perf-panel">
          <div className="perf-panel-title">OPEN POSITIONS</div>
          <div className="perf-panel-body trading-list">
            {positions.length === 0 ? (
              <div className="perf-empty">Fully in cash.</div>
            ) : (
              positions.map((p) => <PositionRow key={p.symbol} p={p} />)
            )}
          </div>
        </div>
        <div className="perf-panel">
          <div className="perf-panel-title">RECENT ACTIONS</div>
          <div className="perf-panel-body trading-list">
            {actions.length === 0 ? (
              <div className="perf-empty">No trades yet.</div>
            ) : (
              actions.map((a, i) => <ActionRow key={`${a.createdAt}-${i}`} a={a} />)
            )}
          </div>
          {data.lastReflection && (
            <div className="perf-experiment">
              <span className="perf-experiment-label">Last reflection</span> {data.lastReflection.headline}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
