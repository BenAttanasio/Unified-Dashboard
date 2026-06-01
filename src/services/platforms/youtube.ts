import { fetchJson } from "@/lib/fetcher";
import type { MetricValues } from "@/lib/constants";

// YouTube Data API v3 — channel statistics. 1 quota unit per call.
interface YouTubeResponse {
  items?: Array<{
    statistics?: {
      subscriberCount?: string;
      viewCount?: string;
      videoCount?: string;
    };
  }>;
}

export function isConfigured(): boolean {
  return Boolean(process.env.YOUTUBE_API_KEY && process.env.YOUTUBE_CHANNEL_ID);
}

export async function fetchYouTube(): Promise<MetricValues> {
  const key = process.env.YOUTUBE_API_KEY!;
  const channelId = process.env.YOUTUBE_CHANNEL_ID!;
  const url =
    `https://www.googleapis.com/youtube/v3/channels` +
    `?part=statistics&id=${encodeURIComponent(channelId)}&key=${encodeURIComponent(key)}`;

  const data = await fetchJson<YouTubeResponse>(url);
  const stats = data.items?.[0]?.statistics;
  if (!stats) throw new Error("YouTube: channel not found or empty statistics");

  return {
    subscribers: Number(stats.subscriberCount ?? 0),
    views: Number(stats.viewCount ?? 0),
    videos: Number(stats.videoCount ?? 0),
  };
}
