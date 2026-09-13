import { fetchJson } from "@/lib/fetcher";
import { compact } from "@/lib/format";

// YouTube Data API v3 — recent uploads with per-video public stats. Feeds the
// "Recent videos" section and the AI coach. Quota cost per fetch: 3 units
// (channels + playlistItems + videos) out of 10,000/day — negligible.

export interface YtVideo {
  id: string;
  title: string;
  /** ISO 8601 publish timestamp. */
  publishedAt: string;
  durationSec: number;
  /** Heuristic: ≤3 minutes counts as a Short (YouTube's current cutoff). */
  isShort: boolean;
  views: number;
  likes: number;
  comments: number;
}

export interface YtVideosData {
  videos: YtVideo[];
}

interface ChannelResponse {
  items?: Array<{ contentDetails?: { relatedPlaylists?: { uploads?: string } } }>;
}
interface PlaylistResponse {
  items?: Array<{ contentDetails?: { videoId?: string } }>;
}
interface VideosResponse {
  items?: Array<{
    id?: string;
    snippet?: { title?: string; publishedAt?: string };
    contentDetails?: { duration?: string };
    statistics?: { viewCount?: string; likeCount?: string; commentCount?: string };
  }>;
}

// The uploads playlist id never changes for a channel — cache it for the process
// lifetime so steady-state fetches cost 2 quota units instead of 3.
let uploadsPlaylistId: string | null = null;

/** "PT20M43S" → 1243 seconds. */
function parseDuration(iso: string | undefined): number {
  if (!iso) return 0;
  const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!m) return 0;
  return Number(m[1] ?? 0) * 3600 + Number(m[2] ?? 0) * 60 + Number(m[3] ?? 0);
}

export function isConfigured(): boolean {
  return Boolean(process.env.YOUTUBE_API_KEY && process.env.YOUTUBE_CHANNEL_ID);
}

export async function fetchYtVideos(maxResults = 15): Promise<YtVideosData> {
  const key = process.env.YOUTUBE_API_KEY!;
  const channelId = process.env.YOUTUBE_CHANNEL_ID!;
  const base = "https://www.googleapis.com/youtube/v3";

  if (!uploadsPlaylistId) {
    const ch = await fetchJson<ChannelResponse>(
      `${base}/channels?part=contentDetails&id=${encodeURIComponent(channelId)}&key=${encodeURIComponent(key)}`,
    );
    uploadsPlaylistId = ch.items?.[0]?.contentDetails?.relatedPlaylists?.uploads ?? null;
    if (!uploadsPlaylistId) throw new Error("YouTube: uploads playlist not found for channel");
  }

  const pl = await fetchJson<PlaylistResponse>(
    `${base}/playlistItems?part=contentDetails&playlistId=${uploadsPlaylistId}&maxResults=${maxResults}&key=${encodeURIComponent(key)}`,
  );
  const ids = (pl.items ?? []).map((i) => i.contentDetails?.videoId).filter(Boolean) as string[];
  if (ids.length === 0) throw new Error("YouTube: no uploads returned");

  const vs = await fetchJson<VideosResponse>(
    `${base}/videos?part=snippet,statistics,contentDetails&id=${ids.join(",")}&key=${encodeURIComponent(key)}`,
  );

  const videos: YtVideo[] = (vs.items ?? []).map((v) => {
    const durationSec = parseDuration(v.contentDetails?.duration);
    return {
      id: v.id ?? "",
      title: v.snippet?.title ?? "(untitled)",
      publishedAt: v.snippet?.publishedAt ?? "",
      durationSec,
      isShort: durationSec > 0 && durationSec <= 183,
      views: Number(v.statistics?.viewCount ?? 0),
      likes: Number(v.statistics?.likeCount ?? 0),
      comments: Number(v.statistics?.commentCount ?? 0),
    };
  });
  // Newest first (playlist order can drift when stats update).
  videos.sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));

  return { videos };
}

export function summarize(data: YtVideosData): string {
  const latest = data.videos[0];
  if (!latest) return "no uploads";
  return `${data.videos.length} vids · latest "${latest.title.slice(0, 30)}" ${compact(latest.views)} views`;
}
