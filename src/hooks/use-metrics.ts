"use client";
import useSWR from "swr";
import type { MetricsResponse } from "@/lib/types";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export function useMetrics() {
  return useSWR<MetricsResponse>("/api/metrics", fetcher, {
    refreshInterval: 30_000,
    keepPreviousData: true,
  });
}
