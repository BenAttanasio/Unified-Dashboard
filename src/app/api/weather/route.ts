import { NextResponse } from "next/server";
import * as live from "@/lib/live-store";
import type { WeatherData } from "@/services/platforms/weather";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Read-only: the scheduler fetches Open-Meteo every 15m and stores the forecast
// in the live store; this route just hands the latest payload to the client.
export function GET() {
  const e = live.get<WeatherData>("weather");
  return NextResponse.json({ status: e.status, fetchedAt: e.fetchedAt, ...e.data });
}
