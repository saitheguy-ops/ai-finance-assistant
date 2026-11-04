"use client";

import { useCallback, useSyncExternalStore } from "react";
import useSWR from "swr";

import {
  applyTrades as applyTradesPure,
  createPortfolio,
  executeTrade,
  parsePortfolio,
  type Portfolio,
  type Trade,
  type TradeResult,
  type TradeSide,
} from "@/lib/portfolio";
import type { WatchlistEntry } from "@/lib/types";
import { errorMessage, fetchJson } from "./fetcher";
import { createLocalStore } from "./local-store";

const store = createLocalStore<Portfolio>("afa:portfolio:v1", createPortfolio(), parsePortfolio);

/** Exposed for the chat panel, which sends a snapshot to the server. */
export const getPortfolioSnapshot = () => store.get();

async function fetchLivePrice(symbol: string): Promise<number> {
  const res = await fetchJson<{ entries: WatchlistEntry[] }>(`/api/quotes?symbols=${encodeURIComponent(symbol)}`);
  const quote = res.entries[0]?.quote;
  if (!quote) throw new Error(`Couldn't find a ticker called ${symbol}.`);
  return quote.price;
}

/**
 * The paper portfolio lives in localStorage. All rules live in
 * src/lib/portfolio.ts; this hook only wires them to storage and to a fresh
 * price fetch, so every trade fills at the current market price.
 */
export function usePortfolio() {
  const portfolio = useSyncExternalStore(store.subscribe, store.get, store.getServerSnapshot);

  const trade = useCallback(async (side: TradeSide, symbol: string, shares: number): Promise<TradeResult> => {
    let price: number;
    try {
      price = await fetchLivePrice(symbol);
    } catch (err) {
      return { ok: false, error: errorMessage(err) };
    }
    const result = executeTrade(store.get(), { side, symbol, shares, price, source: "manual" });
    if (result.ok) store.set(result.portfolio);
    return result;
  }, []);

  const applyTrades = useCallback((trades: Trade[]) => {
    if (trades.length === 0) return [];
    const { portfolio: next, errors } = applyTradesPure(store.get(), trades);
    store.set(next);
    return errors;
  }, []);

  const reset = useCallback(() => store.set(createPortfolio()), []);

  return { portfolio, trade, applyTrades, reset };
}

/** Live prices for everything currently held, refreshed every 30s. */
export function useHoldingPrices(portfolio: Portfolio) {
  const symbols = Object.keys(portfolio.positions).sort();
  const { data, error, isLoading } = useSWR(
    symbols.length ? `/api/quotes?symbols=${symbols.join(",")}` : null,
    (url: string) => fetchJson<{ entries: WatchlistEntry[] }>(url),
    { refreshInterval: 30_000, keepPreviousData: true },
  );
  const prices: Record<string, number> = {};
  const dayChange: Record<string, number> = {};
  for (const e of data?.entries ?? []) {
    prices[e.quote.symbol] = e.quote.price;
    dayChange[e.quote.symbol] = e.quote.change;
  }
  return { prices, dayChange, error, isLoading: isLoading && symbols.length > 0 };
}
