import { NextResponse } from "next/server";
import * as live from "@/lib/live-store";
import type { TradingData } from "@/services/platforms/trading";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Read-only: the scheduler polls the trading bot's /api/summary every minute
// and stores the payload in the live store; this route just hands it over.
export function GET() {
  const e = live.get<TradingData>("trading");
  return NextResponse.json({ status: e.status, fetchedAt: e.fetchedAt, error: e.error ?? null, ...e.data });
}
