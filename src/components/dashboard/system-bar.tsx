"use client";
import { useState } from "react";
import { useSystem } from "@/hooks/use-system";
import { useLogs } from "@/hooks/use-logs";
import { ago } from "@/lib/format";
import { DetailSheet } from "./detail-sheet";
import { LiveLog } from "./live-log";
import type { SystemStatsView } from "@/lib/types";

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

function toMs(recorded_at: string): number {
  return Date.parse(recorded_at.replace(" ", "T") + "Z");
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="detail-row">
      <span className="detail-label">{label}</span>
      <span className="detail-value">{value}</span>
    </div>
  );
}

function SystemDetail({ d }: { d: SystemStatsView }) {
  const gb = (mb: number | undefined) => (mb != null ? (mb / 1024).toFixed(1) : "—");
  return (
    <div className="detail-list">
      {d.cpu ? (
        <Row label="CPU load (1 / 5 / 15m)" value={`${d.cpu.load1?.toFixed(2)} / ${d.cpu.load5?.toFixed(2)} / ${d.cpu.load15?.toFixed(2)}  ·  ${d.cpu.cores} cores`} />
      ) : null}
      {d.temp != null ? <Row label="Temperature" value={`${d.temp} °C`} /> : null}
      {d.mem ? <Row label="Memory" value={`${gb(d.mem.used)} / ${gb(d.mem.total)} GB  ·  ${d.mem.pct}%`} /> : null}
      {d.swap && d.swap.total ? <Row label="Swap" value={`${d.swap.used} / ${d.swap.total} MB  ·  ${d.swap.pct}%`} /> : null}
      {d.disk ? <Row label="Disk /" value={`${d.disk.used} / ${d.disk.total} GB  ·  ${d.disk.pct}%`} /> : null}
      {d.uptime ? <Row label="Uptime" value={d.uptime} /> : null}
      {d.service ? <Row label={d.service.label} value={d.service.status} /> : null}
    </div>
  );
}

type Sheet = "log" | "service" | "system" | null;

export function SystemBar() {
  const { data } = useSystem();
  const { data: logData } = useLogs(50);
  const [sheet, setSheet] = useState<Sheet>(null);

  const latest = logData?.logs?.[0];
  const service = data && !data.disabled ? data.service : undefined;

  const logTrigger = (
    <button className="log-trigger" onClick={() => setSheet("log")} aria-label="Open activity log">
      <span className="log-pulse" />
      {latest ? (
        <span className="log-latest">
          <span className="log-platform">{latest.platform}</span>
          {latest.status === "ok" ? latest.summary ?? "ok" : latest.error_message ?? latest.status}
          <span style={{ color: "var(--muted)", marginLeft: "0.4rem" }}>· {ago(toMs(latest.recorded_at))}</span>
        </span>
      ) : (
        <span className="log-latest">Live activity</span>
      )}
      <span className="chevron">▲</span>
    </button>
  );

  if (!data || data.disabled) {
    return (
      <div className="system-bar">
        <div className="system-stats">
          <span className="not-configured" style={{ padding: "0 0.7rem" }}>
            System stats available on the Pi only
          </span>
        </div>
        {logTrigger}
      </div>
    );
  }

  return (
    <>
      <div className="system-bar">
        <div className="system-stats">
          <button className="system-stat" onClick={() => setSheet("system")} aria-label="System details">
            <span className={`status-dot ${loadClass(data.cpu?.load1, data.cpu?.cores)}`} />
            CPU <strong>{data.cpu?.load1?.toFixed(2)}</strong>
          </button>
          <button className="system-stat" onClick={() => setSheet("system")} aria-label="System details">
            <span className={`status-dot ${tempClass(data.temp)}`} />
            <strong>{data.temp}°C</strong>
          </button>
          <button className="system-stat" onClick={() => setSheet("system")} aria-label="System details">
            <span className={`status-dot ${pctClass(data.mem?.pct)}`} />
            RAM <strong>{data.mem?.pct}%</strong>
          </button>
          <button className="system-stat" onClick={() => setSheet("system")} aria-label="System details">
            <span className={`status-dot ${pctClass(data.disk?.pct)}`} />
            Disk <strong>{data.disk?.pct}%</strong>
          </button>
          {service ? (
            <button className="system-stat" onClick={() => setSheet("service")} aria-label={`${service.label} status`}>
              <span className={`status-dot ${service.status === "active" ? "ok" : "crit"}`} />
              {service.label} <strong>{service.status}</strong>
              <span className="chevron">▸</span>
            </button>
          ) : null}
          <button className="system-stat" onClick={() => setSheet("system")} aria-label="System details">
            Uptime <strong>{data.uptime}</strong>
          </button>
        </div>
        {logTrigger}
      </div>

      <DetailSheet open={sheet === "log"} onClose={() => setSheet(null)} title="Live activity">
        <LiveLog />
      </DetailSheet>

      <DetailSheet open={sheet === "system"} onClose={() => setSheet(null)} title="System">
        <SystemDetail d={data} />
      </DetailSheet>

      <DetailSheet
        open={sheet === "service"}
        onClose={() => setSheet(null)}
        title={service?.label ?? "Service"}
        badge={service ? <span className={service.status === "active" ? "delta-up" : "delta-down"}>{service.status}</span> : null}
      >
        <pre className="sheet-pre">
          {service?.detail
            ? service.detail
            : service?.status === "active"
              ? "Service is active and healthy."
              : "No detail available."}
        </pre>
      </DetailSheet>
    </>
  );
}
