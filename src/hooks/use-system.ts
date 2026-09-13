"use client";
import useSWR from "swr";
import type { SystemStatsView } from "@/lib/types";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export function useSystem() {
  return useSWR<SystemStatsView>("/api/system", fetcher, {
    refreshInterval: 4_000,
    keepPreviousData: true,
  });
}
