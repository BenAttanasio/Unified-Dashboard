import { NextResponse } from "next/server";
import { dbAvailable } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json({
    status: "ok",
    ts: new Date().toISOString(),
    db: dbAvailable(),
  });
}
