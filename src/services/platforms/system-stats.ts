import fs from "node:fs";
import os from "node:os";
import { execSync } from "node:child_process";

// Ported from the Pi's syshealth-server.js getStats(). Reads /proc directly.
// On any host without /proc (Windows dev, Vercel serverless) it returns
// { disabled: true } so the UI hides the system strip and stays portable.

export interface SystemStats {
  disabled?: boolean;
  ts: string;
  cpu: { load1: number; load5: number; load15: number; cores: number };
  mem: { total: number; used: number; pct: number };
  swap: { total: number; used: number; pct: number };
  temp: number;
  disk: { total: number; used: number; pct: number };
  /** Optional systemd unit health, configured via MONITOR_SERVICE. */
  service?: { label: string; status: string };
  uptime: string;
}

function readFile(path: string): string {
  try {
    return fs.readFileSync(path, "utf8").trim();
  } catch {
    return "";
  }
}

export function isPi(): boolean {
  return process.platform === "linux" && fs.existsSync("/proc/meminfo");
}

export function getSystemStats(): SystemStats | { disabled: true } {
  if (!isPi()) return { disabled: true };

  const meminfo = readFile("/proc/meminfo");
  const memTotal = parseInt((meminfo.match(/MemTotal:\s+(\d+)/) || ["", "0"])[1]);
  const memAvail = parseInt((meminfo.match(/MemAvailable:\s+(\d+)/) || ["", "0"])[1]);
  const swapTotal = parseInt((meminfo.match(/SwapTotal:\s+(\d+)/) || ["", "0"])[1]);
  const swapFree = parseInt((meminfo.match(/SwapFree:\s+(\d+)/) || ["", "0"])[1]);

  const loadavg = (readFile("/proc/loadavg") || "0 0 0").split(" ");
  const tempRaw = parseInt(readFile("/sys/class/thermal/thermal_zone0/temp") || "0");

  let disk = { total: 0, used: 0, pct: 0 };
  try {
    const df = execSync("df -k /", { timeout: 2000 })
      .toString()
      .trim()
      .split("\n")[1]
      .trim()
      .split(/\s+/);
    disk = {
      total: +(Number(df[1]) / 1024 / 1024).toFixed(1),
      used: +(Number(df[2]) / 1024 / 1024).toFixed(1),
      pct: parseInt(df[4]),
    };
  } catch {
    /* leave zeros */
  }

  // Optionally report a systemd user service's status (e.g. another app on the
  // box). Configure with MONITOR_SERVICE=<unit>.service and an optional
  // MONITOR_SERVICE_LABEL. Left unset → this chip is simply omitted.
  let service: { label: string; status: string } | undefined;
  const unit = process.env.MONITOR_SERVICE;
  if (unit && /^[A-Za-z0-9._@-]+$/.test(unit)) {
    let status = "unknown";
    try {
      status = execSync(`systemctl --user is-active ${unit}`, { timeout: 2000 }).toString().trim();
    } catch (e) {
      const err = e as { stdout?: Buffer };
      status = err.stdout ? err.stdout.toString().trim() : "inactive";
    }
    service = {
      label: process.env.MONITOR_SERVICE_LABEL || unit.replace(/\.service$/, ""),
      status,
    };
  }

  const uptimeSecs = parseFloat((readFile("/proc/uptime") || "0").split(" ")[0]);
  const days = Math.floor(uptimeSecs / 86400);
  const hrs = Math.floor((uptimeSecs % 86400) / 3600);
  const mins = Math.floor((uptimeSecs % 3600) / 60);
  const uptime =
    days > 0 ? `${days}d ${hrs}h ${mins}m` : hrs > 0 ? `${hrs}h ${mins}m` : `${mins}m`;

  return {
    ts: new Date().toISOString(),
    cpu: {
      load1: parseFloat(loadavg[0]),
      load5: parseFloat(loadavg[1]),
      load15: parseFloat(loadavg[2]),
      cores: os.cpus().length || 4,
    },
    mem: {
      total: Math.round(memTotal / 1024),
      used: Math.round((memTotal - memAvail) / 1024),
      pct: memTotal > 0 ? Math.round(((memTotal - memAvail) / memTotal) * 100) : 0,
    },
    swap: {
      total: Math.round(swapTotal / 1024),
      used: Math.round((swapTotal - swapFree) / 1024),
      pct: swapTotal > 0 ? Math.round(((swapTotal - swapFree) / swapTotal) * 100) : 0,
    },
    temp: Math.round(tempRaw / 100) / 10,
    disk,
    service,
    uptime,
  };
}
