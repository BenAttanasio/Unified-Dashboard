import { NextResponse } from "next/server";
import * as cache from "@/lib/cache";
import * as live from "@/lib/live-store";
import { getEarliestSince, getValueAt } from "@/lib/db";
import { roster } from "@/lib/roster";
import {
  ROSTER_ACCEL_HOT,
  ROSTER_SPIKE_HOT,
  ROSTER_WINDOW_MS,
  type FetchStatus,
} from "@/lib/constants";
import type { RosterData } from "@/services/platforms/roster-yt";
import type { RosterRow } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Read-only. YouTube rows come from the live store (scheduler fetches every 2h);
// the IG/TikTok rows come from the numeric cache filled by the shared Apify run.
//
// PRIVACY: the roster's handles never leave the server — only the env-supplied
// initials, the derived key, and the numbers are serialized.

/** Growth over the last window, and over the window before it. */
function growth(key: string, metric: string, current: number | null) {
  const w = ROSTER_WINDOW_MS;
  // Half a window of slack: nearest-snapshot matching would otherwise report a
  // confident "+0" on day one, when there simply is no week-old baseline yet.
  const tol = w / 2;
  const at1 = getValueAt(key, metric, w, tol);
  const at2 = getValueAt(key, metric, w * 2, tol);

  // With no week-old baseline, fall back to the oldest point we DO have, and
  // report how far back that reaches. A channel added yesterday should still
  // show that it moved — "nothing" reads as "not growing", which is worse than
  // a delta over a shorter, clearly-labelled window.
  const base = at1 ?? getEarliestSince(key, metric, w)?.value ?? null;
  const ageMs = at1 != null ? w : (getEarliestSince(key, metric, w)?.ageMs ?? null);
  const d7 = current != null && base != null ? current - base : null;
  const windowDays = ageMs != null ? Math.max(1, Math.round(ageMs / 86_400_000)) : null;

  // Acceleration still demands two real windows — it's meaningless otherwise.
  const prev7 = at1 != null && at2 != null ? at1 - at2 : null;
  const accel = at1 != null && prev7 != null && prev7 > 0 && d7 != null ? d7 / prev7 : null;
  return { d7, prev7, accel, windowDays };
}

export function GET() {
  const ytLive = live.get<RosterData>("roster");
  const statsByKey = new Map((ytLive.data?.channels ?? []).map((c) => [c.key, c]));
  // A roster row is only truly "not configured" when its SOURCE is missing;
  // otherwise a blank row just means that source hasn't run yet.
  const ytReady = Boolean(process.env.YOUTUBE_API_KEY);
  const scrapeReady = Boolean(process.env.APIFY_SOCIAL_API_ENDPOINT);

  const channels: RosterRow[] = roster().map((e) => {
    const base = {
      key: e.key,
      label: e.label,
      platform: e.platform,
      recentViews: [] as number[],
      spike: null as number | null,
      lastUploadDays: null as number | null,
      subscribers: null as number | null,
    };

    if (e.platform === "yt") {
      const s = statsByKey.get(e.key);
      const count = s ? s.views : null;
      const g = growth(e.key, "views", count);
      return {
        ...base,
        status: (s ? "ok" : ytLive.status) as FetchStatus,
        fetchedAt: ytLive.fetchedAt,
        count,
        metric: "views",
        subscribers: s?.subscribers ?? null,
        recentViews: s?.recentViews ?? [],
        spike: s?.spike ?? null,
        lastUploadDays: s?.lastUploadDays ?? null,
        ...g,
        hot: isHot(s?.spike ?? null, g.accel, g.d7),
        pending: ytReady && count == null,
      };
    }

    const entry = cache.getEntry(e.key);
    const count = typeof entry.values?.followers === "number" ? entry.values.followers : null;
    const g = growth(e.key, "followers", count);
    return {
      ...base,
      status: entry.status,
      fetchedAt: entry.fetchedAt,
      count,
      metric: "followers",
      ...g,
      hot: isHot(null, g.accel, g.d7),
      pending: scrapeReady && entry.fetchedAt == null,
    };
  });

  return NextResponse.json({
    status: ytLive.status,
    fetchedAt: ytLive.fetchedAt,
    channels,
  });
}

/** One recent upload far outrunning the channel's norm, or growth accelerating. */
function isHot(spike: number | null, accel: number | null, d7: number | null): boolean {
  if (spike != null && spike >= ROSTER_SPIKE_HOT) return true;
  return accel != null && accel >= ROSTER_ACCEL_HOT && (d7 ?? 0) > 0;
}
