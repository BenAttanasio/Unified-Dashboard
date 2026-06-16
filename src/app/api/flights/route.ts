import { NextResponse } from "next/server";
import * as live from "@/lib/live-store";
import type { FlightsData } from "@/services/platforms/flights";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Read-only: the scheduler polls adsb.fi every ~25s and stores the closest
// in-view aircraft in the live store; this route hands it to the client.
export function GET() {
  const e = live.get<FlightsData>("flights");
  return NextResponse.json({ status: e.status, fetchedAt: e.fetchedAt, ...e.data });
}
