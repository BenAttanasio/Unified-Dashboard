"use client";
import { useEffect, useState } from "react";

// Our wall-clock is Central (Austin); we also show Central European time so it's
// easy to coordinate with people over there. Both are rendered from explicit IANA
// zones so they stay correct regardless of the device timezone, and switch with
// daylight saving automatically (America/Chicago: CST/CDT, Europe/Paris: CET/CEST).
const CENTRAL_TZ = "America/Chicago";
const CET_TZ = "Europe/Paris";

export function Clock() {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  if (!now) return <span className="dash-clock">--:--</span>;

  const date = now.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    weekday: "short",
    timeZone: CENTRAL_TZ,
  });
  const time = now.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
    timeZone: CENTRAL_TZ,
  });
  const cet = now.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: CET_TZ,
  });

  return (
    <span className="dash-clock">
      <span className="dash-date">{date}</span>
      {time}
      <span className="dash-zone">CT</span>
      <span className="dash-cet">
        {cet}
        <span className="dash-zone">CET</span>
      </span>
    </span>
  );
}
