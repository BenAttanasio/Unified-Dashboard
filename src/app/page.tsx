import { Clock } from "@/components/dashboard/clock";
import { RevenueSection } from "@/components/dashboard/revenue-section";
import { AudienceSection } from "@/components/dashboard/audience-section";
import { WebSection } from "@/components/dashboard/web-section";
import { SystemBar } from "@/components/dashboard/system-bar";

export default function DashboardPage() {
  return (
    <main className="app">
      <header className="dash-header">
        <span className="dash-title">Business Dashboard</span>
        <Clock />
      </header>

      <div className="layout">
        <RevenueSection />
        <AudienceSection />
        <WebSection />
        <SystemBar />
      </div>
    </main>
  );
}
