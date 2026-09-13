"use client";
import useSWR from "swr";
import type { RosterResponse } from "@/lib/types";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export function useRoster() {
  return useSWR<RosterResponse>("/api/roster", fetcher, {
    refreshInterval: 5 * 60_000,
    keepPreviousData: true,
  });
}
