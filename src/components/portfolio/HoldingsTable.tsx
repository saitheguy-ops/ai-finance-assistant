import Link from "next/link";

import { PriceChange } from "@/components/ui/PriceChange";
import { EmptyState } from "@/components/ui/States";
import { formatMoney, formatShares, formatSignedMoney } from "@/lib/format";
import type { Holding } from "@/lib/portfolio";

/** Holdings as a table on wide screens and stacked rows on phones. */
export function HoldingsTable({ holdings }: { holdings: Holding[] }) {
  if (holdings.length === 0) {
    return <EmptyState>No positions yet. Open a stock page or ask Jarvis to &ldquo;buy 10 AAPL&rdquo;.</EmptyState>;
  }
  return (
    <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      <table className="w-full text-sm">
        <thead className="text-left text-xs text-muted">
          <tr className="border-b border-border">
            <th className="py-2 pr-3 font-medium">Symbol</th>
            <th className="py-2 pr-3 text-right font-medium">Shares</th>
            <th className="hidden py-2 pr-3 text-right font-medium sm:table-cell">Avg cost</th>
            <th className="hidden py-2 pr-3 text-right font-medium sm:table-cell">Price</th>
            <th className="py-2 pr-3 text-right font-medium">Value</th>
            <th className="py-2 text-right font-medium">P&amp;L</th>
            <th className="hidden py-2 pl-3 text-right font-medium md:table-cell">Weight</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {holdings.map((h) => (
            <tr key={h.symbol}>
              <td className="py-3 pr-3 font-semibold">
                <Link href={`/stock/${encodeURIComponent(h.symbol)}`} className="hover:text-accent">
                  {h.symbol}
                </Link>
              </td>
              <td className="tabular py-3 pr-3 text-right">{formatShares(h.shares)}</td>
              <td className="tabular hidden py-3 pr-3 text-right sm:table-cell">{formatMoney(h.avgCost)}</td>
              <td className="tabular hidden py-3 pr-3 text-right sm:table-cell">{h.price === null ? "—" : formatMoney(h.price)}</td>
              <td className="tabular py-3 pr-3 text-right">{h.marketValue === null ? "—" : formatMoney(h.marketValue)}</td>
              <td className="py-3 text-right">
                {h.unrealizedPnl === null || h.unrealizedPnlPercent === null ? (
                  <span className="text-muted">—</span>
                ) : (
                  <div className="flex flex-col items-end">
                    <span className="tabular text-xs">{formatSignedMoney(h.unrealizedPnl)}</span>
                    <PriceChange percent={h.unrealizedPnlPercent} />
                  </div>
                )}
              </td>
              <td className="tabular hidden py-3 pl-3 text-right md:table-cell">{h.weight === null ? "—" : `${h.weight.toFixed(1)}%`}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
