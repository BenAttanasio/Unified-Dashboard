"use client";
import useSWR from "swr";
import type { HistoryPoint } from "@/lib/db";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

interface HistoryResponse {
  platform: string;
  metric: string;
  days: number;
  points: HistoryPoint[];
}

export function useHistory(platform: string, metric: string, days = 30) {
  const url = `/api/metrics/history?platform=${platform}&metric=${metric}&days=${days}`;
  return useSWR<HistoryResponse>(url, fetcher, {
    refreshInterval: 5 * 60_000,
  });
}
