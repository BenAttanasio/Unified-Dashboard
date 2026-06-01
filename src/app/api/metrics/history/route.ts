import { NextRequest, NextResponse } from "next/server";
import { getHistory } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/metrics/history?platform=youtube&metric=subscribers&days=30
export function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const platform = searchParams.get("platform");
  const metric = searchParams.get("metric");
  const days = Number(searchParams.get("days") ?? 30);

  if (!platform || !metric) {
    return NextResponse.json({ error: "platform and metric are required" }, { status: 400 });
  }

  const points = getHistory(platform, metric, days * 24 * 60 * 60 * 1000);
  return NextResponse.json({ platform, metric, days, points });
}
