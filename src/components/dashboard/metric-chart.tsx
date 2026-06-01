"use client";
import { useHistory } from "@/hooks/use-history";
import type { HistoryPoint } from "@/lib/db";
import { deltaClass, signed } from "@/lib/format";
import { Sparkline } from "./sparkline";

interface MetricChartProps {
  platform: string;
  metric: string;
  label: string;
  /** Pre-formatted headline value, e.g. "$13" or "2.5K". */
  value: string;
  /** 24h delta; hidden when null or zero. */
  delta?: number | null;
  color?: string;
  days?: number;
  notConfigured?: boolean;
  stale?: boolean;
  /** Shown in the plot area when there's no data (overrides "collecting…"). */
  emptyNote?: string;
  /** Provide the series directly (e.g. Vercel daily) instead of fetching history. */
  points?: HistoryPoint[];
}

export function MetricChart({
  platform,
  metric,
  label,
  value,
  delta,
  color,
  days = 30,
  notConfigured,
  stale,
  emptyNote,
  points: override,
}: MetricChartProps) {
  // Only fetch history when no series was handed in and the metric is live.
  const { data } = useHistory(platform, metric, days, override == null && !notConfigured);
  const points = override ?? data?.points ?? [];
  const showDelta = !notConfigured && delta != null && delta !== 0;

  return (
    <div className={`chart-card${stale ? " is-stale" : ""}`}>
      <div className="chart-head">
        <span className="chart-label">{label}</span>
        {showDelta ? <span className={`chart-delta ${deltaClass(delta)}`}>{signed(delta)}</span> : null}
      </div>
      <div className="chart-value">{notConfigured ? "—" : value}</div>
      <div className="chart-plot">
        {notConfigured ? (
          <span className="chart-note">{emptyNote ?? "Not configured"}</span>
        ) : points.length === 0 ? (
          <span className="chart-note">{emptyNote ?? "collecting…"}</span>
        ) : (
          <Sparkline points={points} color={color} ariaLabel={`${label} over ${days} days`} />
        )}
      </div>
    </div>
  );
}
