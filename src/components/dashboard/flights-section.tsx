"use client";
import { useFlights } from "@/hooks/use-flights";
import { full } from "@/lib/format";

export function FlightsSection() {
  const { data } = useFlights();
  const f = data?.flight;

  return (
    <section className="section area-flights">
      <div className="section-title section-title-row">
        <span>Overhead <span className="section-caption">NW view</span></span>
        {data?.inView != null ? <span className="section-caption">{data.inView} in view</span> : null}
      </div>

      {f ? (
        <div className="flight-card">
          {f.from || f.to ? (
            <>
              <div className="flight-route">
                <span className="flight-airport">{f.from ?? "—"}</span>
                <span className="flight-arrow">→</span>
                <span className="flight-airport">{f.to ?? "—"}</span>
              </div>
              <div className="flight-cities">
                {f.fromName ?? "Unknown"} → {f.toName ?? "Unknown"}
              </div>
              <div className="flight-meta">
                <span className="flight-callsign">{f.callsign}</span>
                <span className="flight-pos">
                  {f.compass} · {f.distanceMi} mi · {full(f.altitudeFt)} ft
                </span>
              </div>
            </>
          ) : (
            // No published route (private / GA aircraft): lead with the callsign.
            <>
              <div className="flight-route">
                <span className="flight-airport">{f.callsign}</span>
              </div>
              <div className="flight-cities">route unknown · private / GA</div>
              <div className="flight-meta">
                <span className="flight-pos">
                  {f.compass} · {f.distanceMi} mi · {full(f.altitudeFt)} ft
                </span>
              </div>
            </>
          )}
        </div>
      ) : (
        <div className="flight-empty">{data == null ? "Scanning…" : "No flights in view"}</div>
      )}
    </section>
  );
}
