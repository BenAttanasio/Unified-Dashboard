"use client";
import { useId } from "react";
import type { HistoryPoint } from "@/lib/db";

interface SparklineProps {
  points: HistoryPoint[];
  /** Stroke + gradient color. Accepts a CSS var, e.g. "var(--primary)". */
  color?: string;
  /** Show an emphasized dot on the latest value. */
  showLastDot?: boolean;
  /** Render the soft gradient area under the line. */
  fill?: boolean;
  ariaLabel?: string;
  className?: string;
}

// Internal coordinate space. The <svg> stretches to fill its container via
// preserveAspectRatio="none", so VB is just a resolution, not a pixel size.
const VB_W = 100;
const VB_H = 100;
const PAD_Y = VB_H * 0.12; // breathing room top/bottom so peaks aren't clipped

/**
 * Dependency-free inline-SVG sparkline with a gradient area fill. Stretches to
 * fill its parent (set the parent's height). Degrades gracefully:
 *   0 points → dashed baseline · 1 point → centered dot · flat series → flat line.
 */
export function Sparkline({
  points,
  color = "var(--primary)",
  showLastDot = true,
  fill = true,
  ariaLabel,
  className,
}: SparklineProps) {
  const gid = useId();
  const n = points.length;

  // Empty state: a dashed baseline, never a crash.
  if (n === 0) {
    return (
      <span className={`sparkline-wrap${className ? ` ${className}` : ""}`} style={{ color }}>
        <svg className="sparkline" viewBox={`0 0 ${VB_W} ${VB_H}`} preserveAspectRatio="none" aria-label={ariaLabel}>
          <line
            x1="0"
            y1={VB_H / 2}
            x2={VB_W}
            y2={VB_H / 2}
            stroke="currentColor"
            strokeWidth={1}
            strokeDasharray="3 4"
            strokeOpacity={0.35}
            vectorEffect="non-scaling-stroke"
          />
        </svg>
      </span>
    );
  }

  const vals = points.map((p) => p.value);
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const flat = max === min; // no variation → draw a centered flat line, not a bottom rule
  const span = max - min || 1;
  const usable = VB_H - PAD_Y * 2;

  const x = (i: number) => (n === 1 ? VB_W / 2 : (i / (n - 1)) * VB_W);
  const y = (v: number) => (flat ? VB_H / 2 : VB_H - PAD_Y - ((v - min) / span) * usable);

  const lastX = x(n - 1);
  const lastY = y(vals[n - 1]);

  // Single point → just the emphasized dot.
  if (n === 1) {
    return (
      <span className={`sparkline-wrap${className ? ` ${className}` : ""}`} style={{ color }}>
        <svg className="sparkline" viewBox={`0 0 ${VB_W} ${VB_H}`} preserveAspectRatio="none" aria-label={ariaLabel} />
        {showLastDot ? (
          <span className="sparkline-dot" style={{ left: "50%", top: `${(lastY / VB_H) * 100}%` }} />
        ) : null}
      </span>
    );
  }

  const line = points.map((p, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(2)} ${y(p.value).toFixed(2)}`).join(" ");
  const area = `${line} L${x(n - 1).toFixed(2)} ${VB_H} L${x(0).toFixed(2)} ${VB_H} Z`;

  return (
    <span className={`sparkline-wrap${className ? ` ${className}` : ""}`} style={{ color }}>
      <svg className="sparkline" viewBox={`0 0 ${VB_W} ${VB_H}`} preserveAspectRatio="none" aria-label={ariaLabel}>
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="currentColor" stopOpacity={0.28} />
            <stop offset="100%" stopColor="currentColor" stopOpacity={0} />
          </linearGradient>
        </defs>
        {fill ? <path d={area} fill={`url(#${gid})`} stroke="none" /> : null}
        <path
          d={line}
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      {showLastDot ? (
        <span className="sparkline-dot" style={{ left: `${lastX}%`, top: `${(lastY / VB_H) * 100}%` }} />
      ) : null}
    </span>
  );
}
