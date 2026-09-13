"use client";
import useSWR from "swr";
import type { FetchStatus } from "@/lib/constants";
import type { YtVideo } from "@/services/platforms/youtube-videos";
import type { CoachData } from "@/services/platforms/youtube-coach";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export interface VideosResponse {
  status: FetchStatus;
  fetchedAt: number | null;
  videos: YtVideo[];
  coach: Partial<CoachData> & {
    status: FetchStatus;
    fetchedAt: number | null;
    error?: string;
    /** ANTHROPIC_API_KEY present — distinguishes "off" from "not run yet". */
    configured: boolean;
  };
}

export function useVideos() {
  return useSWR<VideosResponse>("/api/videos", fetcher, {
    refreshInterval: 60_000,
    keepPreviousData: true,
  });
}
