import type { ReactNode } from "react";
import { deltaClass, signed } from "@/lib/format";

interface TileProps {
  label: string;
  value: string;
  icon?: ReactNode;
  unit?: string;
  delta?: number | null;
  secondary?: boolean;
  notConfigured?: boolean;
  stale?: boolean;
}

/** A compact metric tile: green label/icon, big number, optional signed delta. */
export function Tile({ label, value, icon, unit, delta, secondary, notConfigured, stale }: TileProps) {
  return (
    <div className={`tile${stale ? " is-stale" : ""}`}>
      <div className="tile-label">
        {icon}
        <span>{label}</span>
      </div>
      {notConfigured ? (
        <span className="not-configured">Not configured</span>
      ) : (
        <div className={`tile-value${secondary ? " secondary" : ""}`}>
          {value}
          {unit ? <span className="tile-unit">{unit}</span> : null}
        </div>
      )}
      {delta != null && !notConfigured ? (
        <div className={`tile-delta ${deltaClass(delta)}`}>{signed(delta)}</div>
      ) : null}
    </div>
  );
}

interface BigMetricProps {
  label: string;
  value: string;
  delta?: number | null;
  notConfigured?: boolean;
  stale?: boolean;
}

/** A larger stacked metric used for the revenue hero (MRR / 30-day revenue). */
export function BigMetric({ label, value, delta, notConfigured, stale }: BigMetricProps) {
  return (
    <div className={`metric-stack${stale ? " is-stale" : ""}`}>
      <div className="tile-label">{label}</div>
      {notConfigured ? (
        <span className="not-configured">Not configured</span>
      ) : (
        <div className="tile-value">
          {value}
          {delta != null ? (
            <span className={`tile-delta ${deltaClass(delta)}`} style={{ marginLeft: "0.5rem" }}>
              {signed(delta)}
            </span>
          ) : null}
        </div>
      )}
    </div>
  );
}
