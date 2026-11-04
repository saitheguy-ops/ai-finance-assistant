"use client";

import Link from "next/link";
import useSWR from "swr";

import { TradePanel } from "@/components/portfolio/TradePanel";
import { Card } from "@/components/ui/Card";
import { PriceChange } from "@/components/ui/PriceChange";
import { ErrorNotice, Skeleton } from "@/components/ui/States";
import { ApiError, errorMessage, fetchJson } from "@/lib/client/fetcher";
import { useWatchlist } from "@/lib/client/watchlist";
import { formatMoney } from "@/lib/format";
import type { NewsItem, Quote } from "@/lib/types";
import { KeyStats } from "./KeyStats";
import { NewsList } from "./NewsList";
import { PriceChart } from "./PriceChart";

interface StockResponse {
  quote: Quote;
  news: NewsItem[] | null;
}

export function StockView({ symbol }: { symbol: string }) {
  const { data, error, mutate } = useSWR(
    `/api/stock/${encodeURIComponent(symbol)}`,
    (url: string) => fetchJson<StockResponse>(url),
    { refreshInterval: 30_000 },
  );
  const watchlist = useWatchlist();
  const watching = watchlist.has(symbol);

  if (error && !data) {
    if (error instanceof ApiError && error.code === "NOT_FOUND") {
      return (
        <div className="mx-auto max-w-md py-16 text-center">
          <p className="text-4xl" aria-hidden>
            🔎
          </p>
          <h1 className="mt-3 text-xl font-semibold">We couldn&apos;t find {symbol}</h1>
          <p className="mt-2 text-sm text-muted">Check the spelling, or search for the company on the dashboard.</p>
          <Link href="/" className="mt-6 inline-block rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-contrast">
            Back to dashboard
          </Link>
        </div>
      );
    }
    return (
      <div className="grid gap-4">
        <h1 className="text-2xl font-bold">{symbol}</h1>
        <ErrorNotice message={errorMessage(error)} onRetry={() => void mutate()} />
      </div>
    );
  }

  const quote = data?.quote;

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold">{symbol}</h1>
            {quote?.exchange && <span className="rounded bg-surface-2 px-1.5 py-0.5 text-xs text-muted">{quote.exchange}</span>}
          </div>
          {quote ? <p className="truncate text-sm text-muted">{quote.name}</p> : <Skeleton className="mt-1 h-4 w-40" />}
        </div>
        <button
          type="button"
          onClick={() => (watching ? watchlist.remove(symbol) : watchlist.add(symbol))}
          className="rounded-lg border border-border px-3 py-1.5 text-sm hover:bg-surface-2"
          aria-pressed={watching}
        >
          {watching ? "★ Watching" : "☆ Add to watchlist"}
        </button>
      </div>

      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        {quote ? (
          <>
            <span className="tabular text-4xl font-bold">{formatMoney(quote.price, quote.currency)}</span>
            <PriceChange change={quote.change} percent={quote.changePercent} currency={quote.currency} size="lg" />
            <span className="text-xs text-muted">
              today
              {quote.asOf && ` · as of ${new Date(quote.asOf).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`}
              {quote.marketState && quote.marketState !== "REGULAR" && " · market closed"}
            </span>
          </>
        ) : (
          <Skeleton className="h-10 w-48" />
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <PriceChart symbol={symbol} currency={quote?.currency} />
        </Card>
        <div className="grid content-start gap-4">
          <TradePanel symbol={symbol} price={quote?.price ?? null} currency={quote?.currency} />
          <Card title="Key stats">{quote ? <KeyStats quote={quote} /> : <Skeleton className="h-40 w-full" />}</Card>
        </div>
      </div>

      <Card title="Recent news">{data ? <NewsList news={data.news} /> : <Skeleton className="h-32 w-full" />}</Card>
    </div>
  );
}
