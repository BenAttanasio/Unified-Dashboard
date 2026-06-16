"use client";
import useSWR from "swr";
import type { FetchStatus } from "@/lib/constants";
import type { FlightsData } from "@/services/platforms/flights";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export type FlightsResponse = Partial<FlightsData> & {
  status: FetchStatus;
  fetchedAt: number | null;
};

export function useFlights() {
  return useSWR<FlightsResponse>("/api/flights", fetcher, {
    refreshInterval: 20_000,
    keepPreviousData: true,
  });
}
