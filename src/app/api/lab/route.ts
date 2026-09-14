import { NextResponse } from "next/server";
import * as live from "@/lib/live-store";
import type { LabData } from "@/services/platforms/site-analytics";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Read-only: tickSite polls benattanasio.com /api/stats every 5m and splits the
// response into the numeric site metrics (cache) and this Lab breakdown (live
// store). This route just hands the latter over.
export function GET() {
  const e = live.get<LabData>("lab");
  return NextResponse.json({ status: e.status, fetchedAt: e.fetchedAt, error: e.error ?? null, ...e.data });
}
