"use client";
import useSWR from "swr";
import type { FetchStatus } from "@/lib/constants";
import type { WeatherData } from "@/services/platforms/weather";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export type WeatherResponse = Partial<WeatherData> & {
  status: FetchStatus;
  fetchedAt: number | null;
};

export function useWeather() {
  return useSWR<WeatherResponse>("/api/weather", fetcher, {
    refreshInterval: 60_000,
    keepPreviousData: true,
  });
}
