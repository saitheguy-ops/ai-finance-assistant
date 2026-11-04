"use client";

import Link from "next/link";
import { useState } from "react";

import { Card } from "@/components/ui/Card";
import { usePortfolio } from "@/lib/client/portfolio-store";
import { formatMoney, formatShares } from "@/lib/format";
import type { TradeSide } from "@/lib/portfolio";

type Status = { kind: "ok" | "error"; text: string } | null;

/** Buy/sell box on the stock page. Fills at the live price fetched on submit. */
export function TradePanel({ symbol, price, currency = "USD" }: { symbol: string; price: number | null; currency?: string }) {
  const { portfolio, trade } = usePortfolio();
  const [shares, setShares] = useState("1");
  const [busy, setBusy] = useState<TradeSide | null>(null);
  const [status, setStatus] = useState<Status>(null);

  const owned = portfolio.positions[symbol]?.shares ?? 0;
  const qty = Number(shares);
  const validQty = Number.isInteger(qty) && qty > 0;

  async function submit(side: TradeSide) {
    if (!validQty) {
      setStatus({ kind: "error", text: "Enter a whole number of shares." });
      return;
    }
    setBusy(side);
    setStatus(null);
    const result = await trade(side, symbol, qty);
    setBusy(null);
    setStatus(
      result.ok
        ? {
            kind: "ok",
            text: `${side === "buy" ? "Bought" : "Sold"} ${formatShares(qty)} ${symbol} at ${formatMoney(result.trade.price, currency)}${
              result.trade.realizedPnl !== null ? ` (realized ${formatMoney(result.trade.realizedPnl, currency)})` : ""
            }.`,
          }
        : { kind: "error", text: result.error },
    );
  }

  return (
    <Card title="Paper trade" action={<span className="rounded bg-surface-2 px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-muted uppercase">Fake money</span>}>
      <dl className="mb-3 grid grid-cols-2 gap-2 text-sm">
        <div>
          <dt className="text-xs text-muted">Cash</dt>
          <dd className="tabular font-semibold">{formatMoney(portfolio.cash)}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted">You own</dt>
          <dd className="tabular font-semibold">
            {formatShares(owned)} share{owned === 1 ? "" : "s"}
          </dd>
        </div>
      </dl>
      <label className="text-xs text-muted" htmlFor={`qty-${symbol}`}>
        Shares
      </label>
      <input
        id={`qty-${symbol}`}
        inputMode="numeric"
        value={shares}
        onChange={(e) => setShares(e.target.value.replace(/[^\d]/g, ""))}
        className="tabular mt-1 w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm outline-none focus:border-accent"
      />
      <p className="mt-1 text-xs text-muted">
        Est. {price !== null && validQty ? formatMoney(qty * price, currency) : "—"} at the current price
      </p>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <button
          type="button"
          disabled={busy !== null || price === null}
          onClick={() => void submit("buy")}
          className="rounded-lg bg-buy px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          {busy === "buy" ? "Buying…" : "Buy"}
        </button>
        <button
          type="button"
          disabled={busy !== null || price === null || owned === 0}
          onClick={() => void submit("sell")}
          className="rounded-lg bg-sell px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          {busy === "sell" ? "Selling…" : "Sell"}
        </button>
      </div>
      {status && (
        <p role="status" className={`mt-3 text-sm ${status.kind === "ok" ? "text-up" : "text-down"}`}>
          {status.text}{" "}
          {status.kind === "ok" && (
            <Link href="/portfolio" className="underline">
              View portfolio
            </Link>
          )}
        </p>
      )}
    </Card>
  );
}
