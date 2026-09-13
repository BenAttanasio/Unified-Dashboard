import { NextResponse } from "next/server";
import * as live from "@/lib/live-store";
import type { YtVideosData } from "@/services/platforms/youtube-videos";
import type { CoachData } from "@/services/platforms/youtube-coach";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Read-only: the scheduler fetches per-video stats hourly and runs the AI coach
// every 12h; this route hands both payloads to the client in one response.
export function GET() {
  const v = live.get<YtVideosData>("ytvideos");
  const c = live.get<CoachData>("coach");
  return NextResponse.json({
    status: v.status,
    fetchedAt: v.fetchedAt,
    videos: v.data?.videos ?? [],
    // `configured` separates "no API key" from "hasn't run yet" — the live store
    // starts every key as not_configured, so status alone can't tell them apart
    // and the panel would claim the key is missing after every restart.
    coach: {
      status: c.status,
      fetchedAt: c.fetchedAt,
      error: c.error,
      configured: Boolean(process.env.ANTHROPIC_API_KEY),
      ...(c.data ?? {}),
    },
  });
}
