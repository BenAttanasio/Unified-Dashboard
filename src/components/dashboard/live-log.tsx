"use client";
import { useLogs } from "@/hooks/use-logs";
import { ago } from "@/lib/format";
import type { LogRow } from "@/lib/db";

function dotClass(status: string): string {
  if (status === "ok") return "ok";
  if (status === "rate_limited") return "warn";
  if (status === "error") return "crit";
  return "";
}

// SQLite stores recorded_at as "YYYY-MM-DD HH:MM:SS" in UTC.
function toMs(recorded_at: string): number {
  return Date.parse(recorded_at.replace(" ", "T") + "Z");
}

export function LiveLogRowLine({ row }: { row: LogRow }) {
  const text = row.status === "ok" ? row.summary ?? "ok" : row.error_message ?? row.status;
  return (
    <div className="log-row">
      <span className={`status-dot ${dotClass(row.status)}`} />
      <span className="log-platform">{row.platform}</span>
      <span className={`log-summary${row.status !== "ok" ? " log-error" : ""}`}>{text}</span>
      <span className="log-time">{ago(toMs(row.recorded_at))}</span>
    </div>
  );
}

export function LiveLog() {
  const { data } = useLogs(50);
  const logs = data?.logs ?? [];

  if (logs.length === 0) {
    return <div className="log-empty">No activity logged yet — waiting for the first fetch…</div>;
  }

  return (
    <div className="live-log">
      {logs.map((row) => (
        <LiveLogRowLine key={row.id} row={row} />
      ))}
    </div>
  );
}
