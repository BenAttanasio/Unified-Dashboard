"use client";
import useSWR from "swr";
import type { FetchStatus } from "@/lib/constants";
import type { LabData } from "@/services/platforms/site-analytics";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export type LabResponse = Partial<LabData> & {
  status: FetchStatus;
  fetchedAt: number | null;
  error: string | null;
};

export function useLab() {
  // The underlying fetch runs every 5m (INTERVALS.site); polling the cache a bit
  // faster just keeps the "updated Xm ago" line honest.
  return useSWR<LabResponse>("/api/lab", fetcher, {
    refreshInterval: 120_000,
    keepPreviousData: true,
  });
}
