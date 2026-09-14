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
import { LabView } from "@/components/dashboard/lab-view";
import { useTrading } from "@/hooks/use-trading";
import { useLab } from "@/hooks/use-lab";

type View = "kiosk" | "perf" | "lab" | "trading";

const VIEWS: View[] = ["kiosk", "perf", "lab", "trading"];
const TITLES: Record<View, string> = {
  kiosk: "Unified Dashboard",
  perf: "Performance",
  lab: "Lab",
  trading: "Trading",
};
const GLYPHS: Record<View, string> = { kiosk: "◫", perf: "◧", lab: "◰", trading: "◨" };

export default function DashboardPage() {
  const [view, setView] = useState<View>("kiosk");
  const { data: trading } = useTrading();
  const { data: lab } = useLab();
  // A tab only joins the cycle once its source is actually configured, so the
  // toggle never lands on a screen that can only say "set this env var".
  const tradingOn = trading != null && trading.status !== "not_configured";
  const labOn = lab != null && lab.status !== "not_configured";
  const views = VIEWS.filter((v) => (v === "trading" ? tradingOn : v === "lab" ? labOn : true));

  // ?view=perf / ?view=lab / ?view=trading is the fallback for a kiosk with no
  // pointer attached - the toggle button is unreachable there, so the URL has to
  // be able to select it.
  useEffect(() => {
    const v = new URLSearchParams(window.location.search).get("view");
    if (v === "perf" || v === "lab" || v === "trading") setView(v);
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
      ) : view === "lab" ? (
        <LabView />
      ) : (
        <TradingView />
      )}
    </main>
  );
}
