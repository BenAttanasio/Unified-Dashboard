import { fetchJson } from "@/lib/fetcher";
import { compact } from "@/lib/format";
import { byPlatform } from "@/lib/roster";

// Roster YouTube channels — the "is one of these blowing up?" feed.
//
// Free (YouTube Data API v3 key only). Quota per fetch, steady state:
//   1 unit  channels.list (ALL channels batched into one id= call)
// + 2 units per channel (playlistItems + videos)
// ⇒ ~11 units for 5 channels, out of 10,000/day. Handle→id resolution costs one
// extra unit per channel, once per process (ids are immutable, so we memoize).
//
// Subscriber counts barely move on roster channels; what actually screams
// "this one popped" is a single recent upload massively outperforming the
// channel's own normal video. That ratio is `spike` below.

export interface RosterYtStats {
  /** Roster key (ch_<initials>_yt) — also the snapshot/cache key. */
  key: string;
  /** Initials only (from env) — safe to log and render. */
  label: string;
  subscribers: number;
  views: number;
  videos: number;
  /** Views of the recent uploads, OLDEST → NEWEST so they chart left-to-right. */
  recentViews: number[];
  /** Best of the 3 newest uploads ÷ median of the older ones. null = too few uploads. */
  spike: number | null;
  /** Days since the newest upload. */
  lastUploadDays: number | null;
}

export interface RosterData {
  channels: RosterYtStats[];
}

interface ChannelsResponse {
  items?: Array<{
    id?: string;
    statistics?: { subscriberCount?: string; viewCount?: string; videoCount?: string };
    contentDetails?: { relatedPlaylists?: { uploads?: string } };
  }>;
}
interface PlaylistResponse {
  items?: Array<{ contentDetails?: { videoId?: string; videoPublishedAt?: string } }>;
}
interface VideosResponse {
  items?: Array<{ id?: string; statistics?: { viewCount?: string } }>;
}

const BASE = "https://www.googleapis.com/youtube/v3";
/** How many recent uploads to pull per channel (one `videos` call covers all). */
const RECENT = 10;

// handle → channelId. Channel ids never change, so resolving once per process
// keeps the steady-state cost at 1 unit for the whole batched channels call.
const idByHandle = new Map<string, string>();

export function isConfigured(): boolean {
  return Boolean(process.env.YOUTUBE_API_KEY) && byPlatform("yt").length > 0;
}

function median(xs: number[]): number {
  if (xs.length === 0) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const mid = s.length >> 1;
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

/**
 * How hard is a RECENT upload outperforming this channel's normal video?
 * Compares the best of the 3 newest uploads against the median of the older
 * ones, so an old evergreen hit doesn't keep the channel looking hot forever.
 * `views` must be newest-first.
 */
export function computeSpike(views: number[]): number | null {
  if (views.length >= 6) {
    const base = median(views.slice(3));
    return base > 0 ? Math.max(...views.slice(0, 3)) / base : null;
  }
  // Too few uploads to separate "recent" from "baseline" — fall back to the
  // plain best-vs-typical ratio, and give up entirely below 4 videos.
  if (views.length >= 4) {
    const base = median(views);
    return base > 0 ? Math.max(...views) / base : null;
  }
  return null;
}

async function resolveIds(handles: string[], key: string): Promise<void> {
  for (const h of handles) {
    if (idByHandle.has(h)) continue;
    const res = await fetchJson<ChannelsResponse>(
      `${BASE}/channels?part=id&forHandle=${encodeURIComponent("@" + h)}&key=${encodeURIComponent(key)}`,
    );
    const id = res.items?.[0]?.id;
    // Don't throw: one dead handle shouldn't take the whole section down.
    if (id) idByHandle.set(h, id);
  }
}

/** Recent upload views for one channel, newest-first. 2 quota units. */
async function recentUploads(
  uploadsPlaylist: string,
  key: string,
): Promise<{ views: number[]; lastUploadDays: number | null }> {
  const pl = await fetchJson<PlaylistResponse>(
    `${BASE}/playlistItems?part=contentDetails&playlistId=${uploadsPlaylist}` +
      `&maxResults=${RECENT}&key=${encodeURIComponent(key)}`,
  );
  const items = (pl.items ?? []).filter((i) => i.contentDetails?.videoId);
  if (items.length === 0) return { views: [], lastUploadDays: null };

  // playlistItems is newest-first; keep that order when mapping stats back.
  const ids = items.map((i) => i.contentDetails!.videoId!) as string[];
  const vs = await fetchJson<VideosResponse>(
    `${BASE}/videos?part=statistics&id=${ids.join(",")}&key=${encodeURIComponent(key)}`,
  );
  const viewsById = new Map<string, number>();
  for (const v of vs.items ?? []) {
    if (v.id) viewsById.set(v.id, Number(v.statistics?.viewCount ?? 0));
  }

  const newest = items[0].contentDetails?.videoPublishedAt;
  const publishedMs = newest ? Date.parse(newest) : NaN;
  return {
    views: ids.map((id) => viewsById.get(id) ?? 0),
    lastUploadDays: Number.isFinite(publishedMs)
      ? Math.max(0, Math.floor((Date.now() - publishedMs) / 86_400_000))
      : null,
  };
}

export async function fetchRosterYt(): Promise<RosterData> {
  const key = process.env.YOUTUBE_API_KEY!;
  const entries = byPlatform("yt");

  await resolveIds(
    entries.map((e) => e.handle),
    key,
  );
  const known = entries.filter((e) => idByHandle.has(e.handle));
  if (known.length === 0) throw new Error("Roster: no channel handles resolved");

  // One batched call for every channel's stats + uploads playlist (1 unit total).
  const ids = known.map((e) => idByHandle.get(e.handle)!);
  const res = await fetchJson<ChannelsResponse>(
    `${BASE}/channels?part=statistics,contentDetails&id=${ids.join(",")}&key=${encodeURIComponent(key)}`,
  );
  const byId = new Map((res.items ?? []).filter((i) => i.id).map((i) => [i.id!, i]));

  const channels: RosterYtStats[] = [];
  for (const e of known) {
    const item = byId.get(idByHandle.get(e.handle)!);
    if (!item) continue;
    // A channel that has never uploaded still advertises an uploads playlist id,
    // but fetching it 404s. Treat any per-channel upload failure as "no uploads"
    // so one empty or broken channel can't take the whole section down.
    const uploads = item.contentDetails?.relatedPlaylists?.uploads;
    const empty: { views: number[]; lastUploadDays: number | null } = {
      views: [],
      lastUploadDays: null,
    };
    let recent = empty;
    if (uploads) {
      try {
        recent = await recentUploads(uploads, key);
      } catch {
        recent = empty;
      }
    }

    channels.push({
      key: e.key,
      label: e.label,
      subscribers: Number(item.statistics?.subscriberCount ?? 0),
      views: Number(item.statistics?.viewCount ?? 0),
      videos: Number(item.statistics?.videoCount ?? 0),
      spike: computeSpike(recent.views),
      // Reverse to oldest→newest so the bar strip reads left-to-right in time.
      recentViews: [...recent.views].reverse(),
      lastUploadDays: recent.lastUploadDays,
    });
  }
  if (channels.length === 0) throw new Error("Roster: no channel statistics returned");
  return { channels };
}

/** Log line: how many channels, and whichever one is running hottest. */
export function summarize(data: RosterData): string {
  const n = data.channels.length;
  const hottest = data.channels
    .filter((c) => c.spike != null)
    .sort((a, b) => (b.spike ?? 0) - (a.spike ?? 0))[0];
  const views = data.channels.reduce((sum, c) => sum + c.views, 0);
  if (!hottest) return `${n} channels · ${compact(views)} views`;
  return `${n} channels · ${compact(views)} views · ${hottest.label} spike ${hottest.spike!.toFixed(1)}×`;
}
