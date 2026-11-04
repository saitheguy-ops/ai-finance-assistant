"use client";

import { useCallback, useSyncExternalStore } from "react";

import { normalizeSymbol } from "@/lib/market/symbols";
import { createLocalStore } from "./local-store";

export const DEFAULT_WATCHLIST = ["AAPL", "MSFT", "NVDA", "TSLA", "GOOGL", "AMZN"];
export const MAX_WATCHLIST = 25;

const store = createLocalStore<string[]>("afa:watchlist:v1", DEFAULT_WATCHLIST, (raw) => {
  if (!Array.isArray(raw)) return null;
  const symbols = raw.map((s) => (typeof s === "string" ? normalizeSymbol(s) : null));
  return symbols.filter((s): s is string => s !== null).slice(0, MAX_WATCHLIST);
});

/** The watchlist is just an ordered list of tickers saved in localStorage. */
export function useWatchlist() {
  const symbols = useSyncExternalStore(store.subscribe, store.get, store.getServerSnapshot);

  const add = useCallback((symbol: string) => {
    store.set((prev) =>
      prev.includes(symbol) || prev.length >= MAX_WATCHLIST ? prev : [...prev, symbol],
    );
  }, []);

  const remove = useCallback((symbol: string) => {
    store.set((prev) => prev.filter((s) => s !== symbol));
  }, []);

  return { symbols, add, remove, has: (s: string) => symbols.includes(s) };
}
