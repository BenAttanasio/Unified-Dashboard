import { Clock } from "@/components/dashboard/clock";
import { LiveStatus } from "@/components/dashboard/live-status";
import { RevenueSection } from "@/components/dashboard/revenue-section";
import { AudienceSection } from "@/components/dashboard/audience-section";
import { WebSection } from "@/components/dashboard/web-section";
import { SiteSection } from "@/components/dashboard/site-section";
import { WeatherSection } from "@/components/dashboard/weather-section";
import { FlightsSection } from "@/components/dashboard/flights-section";
import { SystemBar } from "@/components/dashboard/system-bar";

export default function DashboardPage() {
  return (
    <main className="app">
      <header className="dash-header">
        <span className="dash-title">Unified Dashboard</span>
        <span className="dash-header-right">
          <LiveStatus />
          <Clock />
        </span>
      </header>

      <div className="layout">
        <RevenueSection />
        <AudienceSection />
        <WebSection />
        <SiteSection />
        <WeatherSection />
        <FlightsSection />
        <SystemBar />
      </div>
    </main>
  );
}
