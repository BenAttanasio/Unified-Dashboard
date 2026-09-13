import { NextResponse } from "next/server";
import { getSystemStats } from "@/services/platforms/system-stats";

// Runs on the Node runtime (needs fs / child_process). Never cached — live stats.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json(getSystemStats());
}
