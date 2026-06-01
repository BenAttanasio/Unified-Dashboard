"use client";
import { useEffect, useState } from "react";

export function Clock() {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  if (!now) return <span className="dash-clock">--:--</span>;

  const date = now.toLocaleDateString("en-US", { month: "short", day: "numeric", weekday: "short" });
  const time = now.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  return (
    <span className="dash-clock">
      <span className="dash-date">{date}</span>
      {time}
    </span>
  );
}
