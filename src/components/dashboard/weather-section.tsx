"use client";
import { useWeather } from "@/hooks/use-weather";
import type { WeatherHour } from "@/services/platforms/weather";

// Color encodes "is this rain-grade", height encodes the % chance — so a tall
// faint bar = "high chance but barely any water" (the honest "probably just clouds"
// case), and a coral bar = real predicted rain.
function barColor(h: WeatherHour): string {
  if (h.prob >= 55 && h.precip >= 0.2) return "var(--primary)"; // genuine rain
  if (h.prob >= 40) return "var(--info)"; // some chance
  return "var(--divider)"; // negligible
}

function verdictColor(level: string | undefined): string {
  if (level === "rain") return "var(--primary)";
  if (level === "maybe") return "var(--info)";
  return "var(--accent)"; // dry → green "you're good"
}

export function WeatherSection() {
  const { data } = useWeather();
  const hours = data?.hours ?? [];
  const verdict = data?.verdict;
  const loading = data == null || data.status === "not_configured";

  return (
    <section className="section area-weather">
      <div className="section-title">Rain · next 24h</div>

      <div className="weather-verdict" style={{ color: verdictColor(verdict?.level) }}>
        {verdict?.text ?? (loading ? "Loading…" : "—")}
      </div>
      <div className="weather-current">
        {data?.tempF != null ? <span className="weather-temp">{data.tempF}°F</span> : null}
        {data?.rainingNow ? <span className="weather-now-tag">raining now</span> : null}
      </div>

      <div className="weather-bar" role="img" aria-label="Hourly rain timeline: past 2 hours, now, next 24 hours">
        {hours.map((h) => (
          <div className="weather-col" key={h.time} title={`${h.label} · ${Math.round(h.prob)}% · ${h.precip.toFixed(1)}mm`}>
            <div className="weather-track">
              <div
                className={`weather-fill${h.now ? " is-now" : ""}${h.past ? " is-past" : ""}`}
                style={{ height: `${Math.max(4, Math.min(100, h.prob))}%`, background: barColor(h) }}
              />
            </div>
          </div>
        ))}
      </div>
      <div className="weather-axis">
        <span>{hours[0]?.label ?? "-2h"}</span>
        <span className="weather-axis-now">now</span>
        <span>+24h</span>
      </div>
    </section>
  );
}
