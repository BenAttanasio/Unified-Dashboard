import { fetchJson } from "@/lib/fetcher";

// Rain-focused forecast from Open-Meteo (FREE, no API key, no signup).
//
// The goal is a plain-English "is it actually gonna rain on me" read, not a vague
// percentage. We pull the hourly precipitation PROBABILITY (%) and the predicted
// precipitation AMOUNT (mm) for a window of past 2h → now → next 24h, then derive
// a verdict that only calls it "rain" when BOTH the chance is meaningful AND there's
// real water predicted — so a "55% chance / 0.0mm" hour reads as "likely dry", which
// is the honest answer.

// Defaults are generic downtown Austin (public-safe). The real location is set via
// HOME_LAT/HOME_LON in .env (gitignored) — this repo is public, so no home PII here.
const HOME_LAT = Number(process.env.HOME_LAT ?? 30.2672);
const HOME_LON = Number(process.env.HOME_LON ?? -97.7431);
const TZ = process.env.HOME_TZ ?? "America/Chicago";

// "It's going to rain" thresholds (same hour must clear both).
const RAIN_PROB = 55; // % chance
const RAIN_MM = 0.2; // mm — below this is drizzle/none
const MAYBE_PROB = 50; // % chance with little/no predicted amount → "maybe"

export interface WeatherHour {
  /** Local ISO, e.g. "2026-06-16T15:00". */
  time: string;
  /** Short label, e.g. "3p" / "now". */
  label: string;
  /** Predicted precipitation amount, mm. */
  precip: number;
  /** Chance of precipitation, 0..100. */
  prob: number;
  /** True for hours before the current hour (the "past 2h" part of the bar). */
  past: boolean;
  /** True for the hour containing "now". */
  now: boolean;
}

export interface WeatherDay {
  /** Local date, "YYYY-MM-DD". */
  date: string;
  /** Short weekday label, e.g. "Mon"; the first day → "Today". */
  label: string;
  /** Max chance of precipitation that day, 0..100. */
  prob: number;
  /** Total predicted precipitation that day, mm. */
  amount: number;
  /** Daily high / low temperature, °F (rounded). */
  tMax: number | null;
  tMin: number | null;
}

export interface WeatherData {
  tempF: number | null;
  /** Current precipitation amount (mm) right now. */
  precipNow: number;
  rainingNow: boolean;
  verdict: { text: string; level: "dry" | "maybe" | "rain" };
  hours: WeatherHour[];
  /** 7-day daily rain-chance outlook (drives the "next 7 days" box). */
  days: WeatherDay[];
  updatedAt: string;
}

interface OpenMeteoResponse {
  current?: { time?: string; temperature_2m?: number; precipitation?: number };
  hourly?: {
    time?: string[];
    precipitation?: number[];
    precipitation_probability?: number[];
    temperature_2m?: number[];
  };
  daily?: {
    time?: string[];
    precipitation_probability_max?: number[];
    precipitation_sum?: number[];
    temperature_2m_max?: number[];
    temperature_2m_min?: number[];
  };
}

export function isConfigured(): boolean {
  return true; // free + keyless — always available
}

/** "2026-06-16T15:00" → "3p"; the hour containing now → "now". */
function hourLabel(iso: string, isNow: boolean): string {
  if (isNow) return "now";
  const h = Number(iso.slice(11, 13));
  const ampm = h < 12 ? "a" : "p";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}${ampm}`;
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
/** "2026-06-23" → "Mon"; the first day of the series → "Today". */
function dayLabel(dateIso: string, isFirst: boolean): string {
  if (isFirst) return "Today";
  // Parse as UTC midnight so the calendar weekday never shifts by timezone.
  return WEEKDAYS[new Date(`${dateIso}T00:00:00Z`).getUTCDay()] ?? dateIso.slice(5);
}

/** "2026-06-16T15:00" → "3pm" for the headline. */
function clockLabel(iso: string): string {
  const h = Number(iso.slice(11, 13));
  const ampm = h < 12 ? "am" : "pm";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}${ampm}`;
}

export async function fetchWeather(): Promise<WeatherData> {
  // forecast_days/past_days are universally supported; we slice the window from the
  // timestamps ourselves so we never depend on past_hours/forecast_hours quirks.
  const params = new URLSearchParams({
    latitude: String(HOME_LAT),
    longitude: String(HOME_LON),
    timezone: TZ,
    temperature_unit: "fahrenheit",
    current: "temperature_2m,precipitation",
    hourly: "precipitation,precipitation_probability,temperature_2m",
    daily: "precipitation_probability_max,precipitation_sum,temperature_2m_max,temperature_2m_min",
    past_days: "1",
    forecast_days: "7",
  });
  const data = await fetchJson<OpenMeteoResponse>(`https://api.open-meteo.com/v1/forecast?${params}`);

  const h = data.hourly;
  if (!h?.time?.length) throw new Error("Open-Meteo: empty hourly forecast");

  const times = h.time;
  const precip = h.precipitation ?? [];
  const probs = h.precipitation_probability ?? [];
  const temps = h.temperature_2m ?? [];

  // "now" = the current hour Open-Meteo reports (already in local TZ, no offset).
  const nowIso = data.current?.time ?? times[0];
  const nowHourKey = nowIso.slice(0, 13); // "YYYY-MM-DDTHH"
  let nowIdx = times.findIndex((t) => t.slice(0, 13) === nowHourKey);
  if (nowIdx < 0) nowIdx = 0;

  // Window: 2 hours of context behind, 24 ahead.
  const from = Math.max(0, nowIdx - 2);
  const to = Math.min(times.length, nowIdx + 25); // inclusive of +24h
  const hours: WeatherHour[] = [];
  for (let i = from; i < to; i++) {
    const isNow = i === nowIdx;
    hours.push({
      time: times[i],
      label: hourLabel(times[i], isNow),
      precip: precip[i] ?? 0,
      prob: probs[i] ?? 0,
      past: i < nowIdx,
      now: isNow,
    });
  }

  // Verdict from the next 24h (now-inclusive forward).
  const ahead = hours.filter((x) => !x.past);
  const firstRain = ahead.find((x) => x.prob >= RAIN_PROB && x.precip >= RAIN_MM);
  const firstMaybe = ahead.find((x) => x.prob >= MAYBE_PROB);
  const maxProb = ahead.reduce((m, x) => Math.max(m, x.prob), 0);

  let verdict: WeatherData["verdict"];
  if (firstRain) {
    const when = firstRain.now ? "now" : `~${clockLabel(firstRain.time)}`;
    verdict = { text: `Rain likely ${when} · ${Math.round(firstRain.prob)}%`, level: "rain" };
  } else if (firstMaybe) {
    const when = firstMaybe.now ? "now" : `~${clockLabel(firstMaybe.time)}`;
    verdict = { text: `Maybe a sprinkle ${when} · ${Math.round(firstMaybe.prob)}%`, level: "maybe" };
  } else if (maxProb >= 30) {
    verdict = { text: `Mostly dry · ${Math.round(maxProb)}% at most`, level: "dry" };
  } else {
    verdict = { text: "No rain next 24h", level: "dry" };
  }

  // 7-day daily outlook for the "next 7 days" box (own Open-Meteo daily block).
  const d = data.daily;
  const days: WeatherDay[] = [];
  if (d?.time?.length) {
    const dProb = d.precipitation_probability_max ?? [];
    const dSum = d.precipitation_sum ?? [];
    const dMax = d.temperature_2m_max ?? [];
    const dMin = d.temperature_2m_min ?? [];
    // forecast_days=7 with past_days=1 yields the past day first; keep the 7 days
    // from today forward by anchoring on the current date.
    const todayKey = nowIso.slice(0, 10);
    let start = d.time.findIndex((t) => t >= todayKey);
    if (start < 0) start = 0;
    for (let i = start; i < d.time.length && days.length < 7; i++) {
      days.push({
        date: d.time[i],
        label: dayLabel(d.time[i], days.length === 0),
        prob: Math.round(dProb[i] ?? 0),
        amount: dSum[i] ?? 0,
        tMax: dMax[i] != null ? Math.round(dMax[i]) : null,
        tMin: dMin[i] != null ? Math.round(dMin[i]) : null,
      });
    }
  }

  const tempF = data.current?.temperature_2m ?? (temps[nowIdx] ?? null);
  const precipNow = data.current?.precipitation ?? 0;

  return {
    tempF: tempF == null ? null : Math.round(tempF),
    precipNow,
    rainingNow: precipNow >= RAIN_MM,
    verdict,
    hours,
    days,
    updatedAt: new Date().toISOString(),
  };
}

/** One-line summary for the live activity log (fetch_logs.summary). */
export function summarize(data: WeatherData): string {
  const t = data.tempF != null ? ` · ${data.tempF}°F` : "";
  return `${data.verdict.text}${t}`;
}
