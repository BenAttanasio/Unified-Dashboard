import { NextRequest, NextResponse } from "next/server";
import { getRecentLogs } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/logs?limit=40 — recent scheduler fetch activity, newest first.
export function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const limit = Math.min(Math.max(Number(searchParams.get("limit") ?? 40), 1), 200);
  return NextResponse.json({ logs: getRecentLogs(limit) });
}
