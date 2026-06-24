"use client";
import { useWeather } from "@/hooks/use-weather";
import type { WeatherDay } from "@/services/platforms/weather";

// Same Open-Meteo fetch as the 24h box (one call, shared live-store entry) — this
// reads the daily `days[]` series for a 7-day rain-chance outlook. Height encodes
// the % chance, color encodes whether it's rain-grade (real water predicted), so a
// tall faint bar = "high chance but barely any rain", a coral bar = genuine rain.
function barColor(d: WeatherDay): string {
  if (d.prob >= 55 && d.amount >= 1) return "var(--primary)"; // genuine rain
  if (d.prob >= 40) return "var(--info)"; // some chance
  return "var(--divider)"; // negligible
}

export function ForecastSection() {
  const { data } = useWeather();
  const days = data?.days ?? [];
  const loading = data == null || data.status === "not_configured";

  return (
    <section className="section area-forecast">
      <div className="section-title">Rain · next 7 days</div>

      {days.length === 0 ? (
        <div className="weather-verdict" style={{ color: "var(--muted)" }}>
          {loading ? "Loading…" : "—"}
        </div>
      ) : (
        <div className="forecast-row" role="img" aria-label="Daily rain chance for the next 7 days">
          {days.map((d, i) => (
            <div
              className={`forecast-col${i === 0 ? " is-today" : ""}`}
              key={d.date}
              title={`${d.label} · ${d.prob}% · ${d.amount.toFixed(1)}mm`}
            >
              <span className="forecast-prob">{d.prob}%</span>
              <div className="forecast-track">
                <div
                  className="forecast-fill"
                  style={{ height: `${Math.max(4, Math.min(100, d.prob))}%`, background: barColor(d) }}
                />
              </div>
              <span className="forecast-day">{d.label}</span>
              {d.tMax != null ? <span className="forecast-temp">{d.tMax}°</span> : null}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
