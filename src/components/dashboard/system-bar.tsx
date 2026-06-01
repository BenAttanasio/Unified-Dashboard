"use client";
import { useSystem } from "@/hooks/use-system";

function pctClass(pct: number | undefined): string {
  if (pct == null) return "";
  if (pct >= 90) return "crit";
  if (pct >= 70) return "warn";
  return "ok";
}

function tempClass(t: number | undefined): string {
  if (t == null) return "";
  if (t >= 75) return "crit";
  if (t >= 60) return "warn";
  return "ok";
}

function loadClass(load: number | undefined, cores: number | undefined): string {
  if (load == null || !cores) return "";
  const perCore = load / cores;
  if (perCore >= 1) return "crit";
  if (perCore >= 0.7) return "warn";
  return "ok";
}

export function SystemBar() {
  const { data } = useSystem();

  if (!data || data.disabled) {
    return (
      <div className="system-bar">
        <span className="not-configured">System stats available on the Pi only</span>
      </div>
    );
  }

  return (
    <div className="system-bar">
      <span className="system-stat">
        <span className={`status-dot ${loadClass(data.cpu?.load1, data.cpu?.cores)}`} />
        CPU <strong>{data.cpu?.load1?.toFixed(2)}</strong>
      </span>
      <span className="system-stat">
        <span className={`status-dot ${tempClass(data.temp)}`} />
        <strong>{data.temp}°C</strong>
      </span>
      <span className="system-stat">
        <span className={`status-dot ${pctClass(data.mem?.pct)}`} />
        RAM <strong>{data.mem?.pct}%</strong>
      </span>
      <span className="system-stat">
        <span className={`status-dot ${pctClass(data.disk?.pct)}`} />
        Disk <strong>{data.disk?.pct}%</strong>
      </span>
      {data.service ? (
        <span className="system-stat">
          <span className={`status-dot ${data.service.status === "active" ? "ok" : "crit"}`} />
          {data.service.label} <strong>{data.service.status}</strong>
        </span>
      ) : null}
      <span className="system-stat">
        Uptime <strong>{data.uptime}</strong>
      </span>
    </div>
  );
}
