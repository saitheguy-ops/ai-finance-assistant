"use client";

import Link from "next/link";
import useSWR from "swr";

import { Card } from "@/components/ui/Card";
import { PriceChange } from "@/components/ui/PriceChange";
import { Sparkline } from "@/components/ui/Sparkline";
import { EmptyState, ErrorNotice, Skeleton } from "@/components/ui/States";
import { errorMessage, fetchJson } from "@/lib/client/fetcher";
import { useWatchlist } from "@/lib/client/watchlist";
import { formatMoney } from "@/lib/format";
import type { WatchlistEntry } from "@/lib/types";
import { AddTicker } from "./AddTicker";

const REFRESH_MS = 30_000;

export function Watchlist() {
  const { symbols, add, remove } = useWatchlist();
  const key = symbols.length ? `/api/quotes?spark=1&symbols=${symbols.join(",")}` : null;
  const { data, error, isLoading, mutate } = useSWR(
    key,
    (url: string) => fetchJson<{ entries: WatchlistEntry[]; missing: string[] }>(url),
    { refreshInterval: REFRESH_MS, keepPreviousData: true },
  );

  const bySymbol = new Map(data?.entries.map((e) => [e.quote.symbol, e]));

  return (
    <Card
      title="Watchlist"
      action={<span className="text-xs text-muted">Refreshes every 30s</span>}
    >
      <AddTicker onAdd={add} existing={symbols} />

      <div className="mt-4">
        {symbols.length === 0 ? (
          <EmptyState>Your watchlist is empty. Add a ticker above to start tracking it.</EmptyState>
        ) : error && !data ? (
          <ErrorNotice message={errorMessage(error)} onRetry={() => void mutate()} />
        ) : (
          <ul className="divide-y divide-border">
            {symbols.map((symbol) => {
              const entry = bySymbol.get(symbol);
              return (
                <li key={symbol} className="group flex items-center gap-3 py-3">
                  <Link href={`/stock/${encodeURIComponent(symbol)}`} className="flex min-w-0 flex-1 items-center gap-3">
                    <div className="w-24 min-w-0 shrink-0 sm:w-40">
                      <p className="font-semibold">{symbol}</p>
                      <p className="truncate text-xs text-muted">
                        {entry?.quote.name ?? (isLoading ? " " : data?.missing.includes(symbol) ? "Not found" : "—")}
                      </p>
                    </div>
                    <div className="flex flex-1 justify-center">
                      {entry ? (
                        <Sparkline
                          points={entry.spark}
                          reference={entry.quote.previousClose}
                          className="h-9 w-16 sm:w-36"
                          label={`${symbol} intraday trend`}
                        />
                      ) : (
                        <Skeleton className="h-9 w-16 sm:w-36" />
                      )}
                    </div>
                    <div className="ml-auto text-right">
                      {entry ? (
                        <>
                          <p className="tabular font-semibold">{formatMoney(entry.quote.price, entry.quote.currency)}</p>
                          <PriceChange percent={entry.quote.changePercent} pill />
                        </>
                      ) : isLoading ? (
                        <>
                          <Skeleton className="ml-auto h-4 w-20" />
                          <Skeleton className="mt-1 ml-auto h-4 w-14" />
                        </>
                      ) : (
                        <p className="text-xs text-muted">No data</p>
                      )}
                    </div>
                  </Link>
                  <button
                    type="button"
                    onClick={() => remove(symbol)}
                    aria-label={`Remove ${symbol} from watchlist`}
                    className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-muted hover:bg-surface-2 hover:text-down"
                  >
                    ×
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        {error && data && (
          <p className="mt-2 text-xs text-warn-text">Showing the last prices we got — refresh failed: {errorMessage(error)}</p>
        )}
      </div>
    </Card>
  );
}
