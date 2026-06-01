"use client";
import { useEffect, useRef, useState } from "react";
import { useMetrics } from "@/hooks/use-metrics";

// Live "heartbeat" for the header: a pulsing dot + a per-second countdown to the
// next auto-refresh, so the kiosk always shows motion instead of looking frozen.
// Mirrors useMetrics()'s 30s SWR refreshInterval; the countdown resets whenever a
// fresh payload lands (data.ts changes) so it stays in sync with real fetches.
const REFRESH_SECONDS = 30;

export function LiveStatus() {
  const { data, isValidating } = useMetrics();
  const [remaining, setRemaining] = useState(REFRESH_SECONDS);
  const lastTs = useRef<string | null>(null);

  // Reset the countdown each time a new metrics payload arrives.
  useEffect(() => {
    if (data?.ts && data.ts !== lastTs.current) {
      lastTs.current = data.ts;
      setRemaining(REFRESH_SECONDS);
    }
  }, [data?.ts]);

  // Tick down once per second (floors at 0 while a refresh is in flight).
  useEffect(() => {
    const t = setInterval(() => setRemaining((r) => (r > 0 ? r - 1 : 0)), 1000);
    return () => clearInterval(t);
  }, []);

  return (
    <span className="live-status" title="Auto-refreshing">
      <span className="live-dot" />
      <span className="live-label">{isValidating ? "updating…" : `next ${remaining}s`}</span>
    </span>
  );
}
