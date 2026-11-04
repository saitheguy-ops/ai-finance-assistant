"use client";

import { useState } from "react";

import { usePortfolio } from "@/lib/client/portfolio-store";
import { formatMoney } from "@/lib/format";
import { normalizeSymbol } from "@/lib/market/symbols";
import type { TradeSide } from "@/lib/portfolio";

/** Compact "symbol + shares + buy/sell" form for the portfolio page. */
export function QuickTrade() {
  const { trade } = usePortfolio();
  const [symbol, setSymbol] = useState("");
  const [shares, setShares] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);

  async function submit(side: TradeSide) {
    const sym = normalizeSymbol(symbol);
    const qty = Number(shares);
    if (!sym) return setStatus({ ok: false, text: "Enter a ticker like AAPL." });
    if (!Number.isInteger(qty) || qty <= 0) return setStatus({ ok: false, text: "Enter a whole number of shares." });
    setBusy(true);
    const r = await trade(side, sym, qty);
    setBusy(false);
    setStatus(
      r.ok
        ? { ok: true, text: `${side === "buy" ? "Bought" : "Sold"} ${qty} ${sym} at ${formatMoney(r.trade.price)}.` }
        : { ok: false, text: r.error },
    );
    if (r.ok) setShares("");
  }

  return (
    <form onSubmit={(e) => e.preventDefault()} className="grid gap-2">
      <div className="grid grid-cols-2 gap-2">
        <input
          aria-label="Ticker"
          placeholder="Ticker"
          value={symbol}
          autoCapitalize="characters"
          onChange={(e) => setSymbol(e.target.value)}
          className="rounded-lg border border-border bg-bg px-3 py-2 text-sm outline-none focus:border-accent"
        />
        <input
          aria-label="Shares"
          placeholder="Shares"
          inputMode="numeric"
          value={shares}
          onChange={(e) => setShares(e.target.value.replace(/[^\d]/g, ""))}
          className="tabular rounded-lg border border-border bg-bg px-3 py-2 text-sm outline-none focus:border-accent"
        />
        <button
          type="button"
          disabled={busy}
          onClick={() => void submit("buy")}
          className="rounded-lg bg-buy px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          Buy
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => void submit("sell")}
          className="rounded-lg bg-sell px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          Sell
        </button>
      </div>
      {status && (
        <p role="status" className={`text-sm ${status.ok ? "text-up" : "text-down"}`}>
          {status.text}
        </p>
      )}
    </form>
  );
}
