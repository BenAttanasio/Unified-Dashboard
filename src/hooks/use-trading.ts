"use client";
import useSWR from "swr";
import type { FetchStatus } from "@/lib/constants";
import type { TradingData } from "@/services/platforms/trading";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export type TradingResponse = Partial<TradingData> & {
  status: FetchStatus;
  fetchedAt: number | null;
  error: string | null;
};

export function useTrading() {
  return useSWR<TradingResponse>("/api/trading", fetcher, {
    refreshInterval: 60_000,
    keepPreviousData: true,
  });
}
