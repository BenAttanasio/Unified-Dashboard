import { fetchJson } from "@/lib/fetcher";

// Trading bot summary (the AI Trader service on this same box, or wherever
// TRADING_BOT_URL points). This is the second documented "another repo's data"
// source after the Performance snapshot — but unlike perf it IS a scheduler
// source: a cheap localhost GET every minute against the bot's /api/summary.
//
// Nothing account-specific lives in this repo: the URL comes from .env and the
// payload is whatever the bot chooses to publish (no keys, no account ids).

const URL = (process.env.TRADING_BOT_URL ?? "").replace(/\/+$/, "");

export interface TradingPosition {
  symbol: string;
  marketValue: number;
  plPercent: number;
  daysHeld: number;
  thesis: string | null;
}

export interface TradingAction {
  symbol: string;
  action: "BUY" | "SELL";
  notional: number;
  trigger: string;
  conviction: number;
  reasoning: string;
  createdAt: string;
}

export interface TradingData {
  updatedAt: string;
  mode: "paper" | "live";
  paused: boolean;
  marketState: string;
  nextPulse: { time: string; label: string };
  equity: number;
  cash: number;
  invested: number;
  dailyPL: number;
  dailyPLPercent: number;
  totalPL: number | null;
  totalPLPercent: number | null;
  startingEquity: number | null;
  positionCount: number;
  positions: TradingPosition[];
  todayStats: { tradesExecuted: number; tradesBlocked: number };
  recentActions: TradingAction[];
  equityCurve: { date: string; value: number }[];
  tokenBudgetPct: number;
  lastReflection: { headline: string; createdAt: string } | null;
  benchmark: { symbol: string; periodReturnPct: number; botReturnPct: number } | null;
}

export function isConfigured(): boolean {
  return URL.length > 0;
}

export async function fetchTrading(): Promise<TradingData> {
  const data = await fetchJson<TradingData>(`${URL}/api/summary`, {}, 10_000);
  if (typeof data?.equity !== "number") throw new Error("trading: malformed summary payload");
  return data;
}

/** One-line summary for the live activity log. */
export function summarize(d: TradingData): string {
  const sign = d.dailyPL >= 0 ? "+" : "-";
  const pl = `${sign}$${Math.abs(d.dailyPL).toFixed(0)} (${sign}${Math.abs(d.dailyPLPercent).toFixed(2)}%)`;
  const state = d.paused ? "PAUSED" : d.marketState.replace("_", " ");
  return `${d.mode} · $${Math.round(d.equity).toLocaleString("en-US")} · ${pl} today · ${d.positionCount} pos · ${state}`;
}
