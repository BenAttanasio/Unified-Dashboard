import { fetchJson } from "@/lib/fetcher";

// The single closest aircraft that's within our field of view, with where it's
// flying from/to. Both data sources are FREE and keyless:
//   • adsb.fi opendata — live ADS-B positions in a radius around a point.
//   • adsbdb.com       — callsign → flight route (origin / destination airport).
//
// We sit on a balcony on South Lamar (Austin) facing NW with a wide (~180°) view,
// so we keep only aircraft whose bearing FROM us falls in that NW arc, then pick
// the nearest one. Field of view + radius are env-overridable.

// Defaults are generic downtown Austin (public-safe). The real balcony location is
// set via HOME_LAT/HOME_LON in .env (gitignored) — this repo is public, no home PII.
const HOME_LAT = Number(process.env.HOME_LAT ?? 30.2672);
const HOME_LON = Number(process.env.HOME_LON ?? -97.7431);
// NW = 315°, ±85° → roughly SW(230°) → W → NW → N → NE(40°): a wide arc to the NW.
const VIEW_CENTER = Number(process.env.VIEW_BEARING_CENTER ?? 315);
const VIEW_HALF = Number(process.env.VIEW_BEARING_HALF ?? 85);
const RADIUS_NM = Number(process.env.FLIGHT_RADIUS_NM ?? 30);

export interface FlightInfo {
  callsign: string;
  /** Origin / destination airport IATA codes (null if route unknown). */
  from: string | null;
  to: string | null;
  /** Human city names for the airports, when adsbdb has them. */
  fromName: string | null;
  toName: string | null;
  altitudeFt: number;
  distanceMi: number;
  /** Bearing from home to the aircraft, degrees (0=N, 90=E). */
  bearing: number;
  /** 8-point compass for that bearing, e.g. "NW". */
  compass: string;
  /** Aircraft's own heading, degrees (where it's going), if reported. */
  track: number | null;
}

export interface FlightsData {
  flight: FlightInfo | null;
  /** Total aircraft returned in the radius. */
  scanned: number;
  /** How many fell inside the field of view. */
  inView: number;
  updatedAt: string;
}

interface AdsbAircraft {
  hex?: string;
  flight?: string;
  lat?: number;
  lon?: number;
  alt_baro?: number | string; // number in ft, or "ground"
  track?: number;
}
interface AdsbResponse {
  ac?: AdsbAircraft[];
  aircraft?: AdsbAircraft[]; // some mirrors use `aircraft`
}

interface AdsbdbAirport {
  iata_code?: string;
  municipality?: string;
  name?: string;
}
interface AdsbdbResponse {
  response?: {
    flightroute?: { origin?: AdsbdbAirport; destination?: AdsbdbAirport };
  };
}

export function isConfigured(): boolean {
  return true; // free + keyless — always available
}

const RAD = Math.PI / 180;

/** Great-circle distance in miles. */
function distanceMi(lat: number, lon: number): number {
  const dLat = (lat - HOME_LAT) * RAD;
  const dLon = (lon - HOME_LON) * RAD;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(HOME_LAT * RAD) * Math.cos(lat * RAD) * Math.sin(dLon / 2) ** 2;
  return 3958.8 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** Initial bearing from home to a point, degrees 0..360. */
function bearingTo(lat: number, lon: number): number {
  const dLon = (lon - HOME_LON) * RAD;
  const y = Math.sin(dLon) * Math.cos(lat * RAD);
  const x =
    Math.cos(HOME_LAT * RAD) * Math.sin(lat * RAD) -
    Math.sin(HOME_LAT * RAD) * Math.cos(lat * RAD) * Math.cos(dLon);
  return (Math.atan2(y, x) / RAD + 360) % 360;
}

const COMPASS = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
function compassOf(bearing: number): string {
  return COMPASS[Math.round(bearing / 45) % 8];
}

/** Is `bearing` within the field-of-view arc? (handles the 360/0 wrap.) */
function inFieldOfView(bearing: number): boolean {
  const diff = ((bearing - VIEW_CENTER + 540) % 360) - 180;
  return Math.abs(diff) <= VIEW_HALF;
}

// Routes never change for a callsign within a process lifetime; cache to avoid
// hammering adsbdb (and to keep the 25s tick cheap). `null` = looked up, unknown.
const routeCache = new Map<string, { from: string | null; to: string | null; fromName: string | null; toName: string | null }>();

async function lookupRoute(callsign: string) {
  const cached = routeCache.get(callsign);
  if (cached) return cached;
  let route = { from: null as string | null, to: null as string | null, fromName: null as string | null, toName: null as string | null };
  try {
    const data = await fetchJson<AdsbdbResponse>(
      `https://api.adsbdb.com/v0/callsign/${encodeURIComponent(callsign)}`,
      { headers: { "User-Agent": "unified-dashboard/1.0" } },
      8000,
    );
    const r = data.response?.flightroute;
    if (r) {
      route = {
        from: r.origin?.iata_code ?? null,
        to: r.destination?.iata_code ?? null,
        fromName: r.origin?.municipality ?? r.origin?.name ?? null,
        toName: r.destination?.municipality ?? r.destination?.name ?? null,
      };
    }
  } catch {
    // Unknown callsign / 404 → leave route null; still cache so we don't refetch.
  }
  routeCache.set(callsign, route);
  return route;
}

export async function fetchFlights(): Promise<FlightsData> {
  const url = `https://opendata.adsb.fi/api/v2/lat/${HOME_LAT}/lon/${HOME_LON}/dist/${RADIUS_NM}`;
  const data = await fetchJson<AdsbResponse>(url, { headers: { "User-Agent": "unified-dashboard/1.0" } }, 10000);
  const list = data.ac ?? data.aircraft ?? [];

  let best: { ac: AdsbAircraft; dist: number; bearing: number; alt: number } | null = null;
  let inView = 0;
  for (const ac of list) {
    if (typeof ac.lat !== "number" || typeof ac.lon !== "number") continue;
    const alt = typeof ac.alt_baro === "number" ? ac.alt_baro : 0;
    if (alt <= 0) continue; // skip on-ground / no altitude
    const bearing = bearingTo(ac.lat, ac.lon);
    if (!inFieldOfView(bearing)) continue;
    inView++;
    const dist = distanceMi(ac.lat, ac.lon);
    if (!best || dist < best.dist) best = { ac, dist, bearing, alt };
  }

  let flight: FlightInfo | null = null;
  if (best) {
    const callsign = (best.ac.flight ?? "").trim();
    const route = callsign ? await lookupRoute(callsign) : { from: null, to: null, fromName: null, toName: null };
    flight = {
      callsign: callsign || best.ac.hex || "unknown",
      ...route,
      altitudeFt: Math.round(best.alt),
      distanceMi: Math.round(best.dist * 10) / 10,
      bearing: Math.round(best.bearing),
      compass: compassOf(best.bearing),
      track: typeof best.ac.track === "number" ? Math.round(best.ac.track) : null,
    };
  }

  return { flight, scanned: list.length, inView, updatedAt: new Date().toISOString() };
}

/** One-line summary for the live activity log (only logged when the flight changes). */
export function summarize(data: FlightsData): string {
  if (!data.flight) return `no aircraft in view (${data.scanned} nearby)`;
  const f = data.flight;
  const route = f.from || f.to ? ` ${f.from ?? "?"}→${f.to ?? "?"}` : "";
  return `${f.callsign}${route} · ${f.compass} ${f.distanceMi}mi`;
}
