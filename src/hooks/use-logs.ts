"use client";
import useSWR from "swr";
import type { LogRow } from "@/lib/db";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

interface LogsResponse {
  logs: LogRow[];
}

export function useLogs(limit = 40) {
  return useSWR<LogsResponse>(`/api/logs?limit=${limit}`, fetcher, {
    refreshInterval: 5_000,
    keepPreviousData: true,
  });
}
