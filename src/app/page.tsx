"use client";

import { useEffect, useState } from "react";
import { Clock } from "@/components/dashboard/clock";
import { LiveStatus } from "@/components/dashboard/live-status";
import { AudienceSection } from "@/components/dashboard/audience-section";
import { RosterSection } from "@/components/dashboard/roster-section";
import { CoachSection } from "@/components/dashboard/coach-section";
import { WeatherSection } from "@/components/dashboard/weather-section";
import { SystemBar } from "@/components/dashboard/system-bar";
import { PerfView } from "@/components/dashboard/perf-view";
import { TradingView } from "@/components/dashboard/trading-view";
import { useTrading } from "@/hooks/use-trading";

type View = "kiosk" | "perf" | "trading";

const TITLES: Record<View, string> = { kiosk: "Unified Dashboard", perf: "Performance", trading: "Trading" };
const GLYPHS: Record<View, string> = { kiosk: "◫", perf: "◧", trading: "◨" };

export default function DashboardPage() {
  const [view, setView] = useState<View>("kiosk");
  const { data: trading } = useTrading();
  // The trading tab only joins the cycle when the bot URL is configured.
  const tradingOn = trading != null && trading.status !== "not_configured";
  const views: View[] = tradingOn ? ["kiosk", "perf", "trading"] : ["kiosk", "perf"];

  // ?view=perf / ?view=trading is the fallback for a kiosk with no pointer
  // attached - the toggle button is unreachable there, so the URL has to be
  // able to select it.
  useEffect(() => {
    const v = new URLSearchParams(window.location.search).get("view");
    if (v === "perf" || v === "trading") setView(v);
  }, []);

  const next = views[(Math.max(0, views.indexOf(view)) + 1) % views.length];

  return (
    <main className="app">
      <header className="dash-header">
        <span className="dash-title">{TITLES[view]}</span>
        <span className="dash-header-right">
          <button
            type="button"
            className="view-toggle"
            onClick={() => setView(next)}
            title={`Show ${TITLES[next]}`}
            aria-label={`Show ${TITLES[next]}`}
          >
            {GLYPHS[next]}
          </button>
          <LiveStatus />
          <Clock />
        </span>
      </header>

      {view === "kiosk" ? (
        <div className="layout">
          <AudienceSection />
          <RosterSection />
          <CoachSection />
          <WeatherSection />
          <SystemBar />
        </div>
      ) : view === "perf" ? (
        <PerfView />
      ) : (
        <TradingView />
      )}
    </main>
  );
}
