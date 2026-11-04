"use client";

import { Card } from "@/components/ui/Card";
import { ErrorNotice } from "@/components/ui/States";
import { useHoldingPrices, usePortfolio } from "@/lib/client/portfolio-store";
import { errorMessage } from "@/lib/client/fetcher";
import { summarizePortfolio } from "@/lib/portfolio";
import { HoldingsTable } from "./HoldingsTable";
import { QuickTrade } from "./QuickTrade";
import { SummaryCards } from "./SummaryCards";
import { TradeHistory } from "./TradeHistory";
import { ValueChart } from "./ValueChart";

export function PortfolioView() {
  const { portfolio, reset } = usePortfolio();
  const { prices, dayChange, error } = useHoldingPrices(portfolio);
  const summary = summarizePortfolio(portfolio, prices);

  const positions = Object.values(portfolio.positions);
  const todayChange =
    positions.length === 0
      ? null
      : positions.every((p) => dayChange[p.symbol] !== undefined)
        ? positions.reduce((sum, p) => sum + p.shares * dayChange[p.symbol], 0)
        : null;

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Paper portfolio</h1>
          <p className="text-sm text-muted">
            Started with {portfolio.startingCash.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 })} of
            fake money. Saved in this browser only.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            if (window.confirm("Reset your paper portfolio to $100,000 cash? This deletes all holdings and trade history.")) reset();
          }}
          className="rounded-lg border border-border px-3 py-1.5 text-sm text-muted hover:text-down"
        >
          Reset portfolio
        </button>
      </div>

      {error && (
        <ErrorNotice
          title="Live prices unavailable"
          message={`${errorMessage(error)} Holdings without a live price are valued at cost.`}
        />
      )}
      {!error && summary.hasMissingPrices && Object.keys(prices).length > 0 && (
        <p className="text-xs text-warn-text">Some holdings have no live price right now and are valued at cost.</p>
      )}

      <SummaryCards summary={summary} dayChange={todayChange} />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card title="Value over time" className="lg:col-span-2">
          <ValueChart portfolio={portfolio} livePrices={prices} />
        </Card>
        <Card title="Quick trade">
          <QuickTrade />
          <p className="mt-3 text-xs text-muted">
            Orders fill instantly at the latest Yahoo Finance price. Whole shares only; no fees, no real money.
          </p>
        </Card>
      </div>

      <Card title="Holdings">
        <HoldingsTable holdings={summary.holdings} />
      </Card>
      <Card title="Trade history">
        <TradeHistory trades={portfolio.trades} />
      </Card>
    </div>
  );
}
