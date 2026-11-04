"use client";

import Link from "next/link";

import { Card } from "@/components/ui/Card";
import { PriceChange } from "@/components/ui/PriceChange";
import { useHoldingPrices, usePortfolio } from "@/lib/client/portfolio-store";
import { formatMoney } from "@/lib/format";
import { summarizePortfolio } from "@/lib/portfolio";

export function PortfolioSnapshot() {
  const { portfolio } = usePortfolio();
  const { prices } = useHoldingPrices(portfolio);
  const s = summarizePortfolio(portfolio, prices);
  return (
    <Card
      title="Paper portfolio"
      action={
        <Link href="/portfolio" className="text-xs font-medium text-accent hover:underline">
          Open →
        </Link>
      }
    >
      <p className="tabular text-3xl font-bold">{formatMoney(s.totalValue)}</p>
      <div className="mt-1">
        <PriceChange change={s.totalPnl} percent={s.totalPnlPercent} /> <span className="text-xs text-muted">all time</span>
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-2 text-sm">
        <div>
          <dt className="text-xs text-muted">Cash</dt>
          <dd className="tabular font-semibold">{formatMoney(s.cash)}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted">Positions</dt>
          <dd className="tabular font-semibold">{s.holdings.length}</dd>
        </div>
      </dl>
    </Card>
  );
}
