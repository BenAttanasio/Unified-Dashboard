import { NextResponse } from "next/server";
import { readPerfSnapshot } from "@/lib/perf-snapshot";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Read-only. The snapshot is produced by the Content Creation Pipeline and
// copied here by tools/push-perf-snapshot.ps1; nothing in this app fetches or
// computes it. Re-read per request so a fresh push shows up without a restart.
export function GET() {
  return NextResponse.json(readPerfSnapshot());
}
