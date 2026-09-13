"use client";
import useSWR from "swr";
import type { PerfResult } from "@/lib/perf-snapshot";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export function usePerf() {
  return useSWR<PerfResult>("/api/perf", fetcher, {
    refreshInterval: 60_000,
    keepPreviousData: true,
  });
}
