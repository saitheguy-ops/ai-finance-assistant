import { EmptyState } from "@/components/ui/States";
import { formatMoney, formatShares, formatSignedMoney } from "@/lib/format";
import type { Trade } from "@/lib/portfolio";

export function TradeHistory({ trades }: { trades: Trade[] }) {
  if (trades.length === 0) return <EmptyState>Your trades will appear here.</EmptyState>;
  const newestFirst = [...trades].reverse();
  return (
    <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      <table className="w-full text-sm">
        <thead className="text-left text-xs text-muted">
          <tr className="border-b border-border">
            <th className="py-2 pr-3 font-medium">When</th>
            <th className="py-2 pr-3 font-medium">Trade</th>
            <th className="hidden py-2 pr-3 text-right font-medium sm:table-cell">Price</th>
            <th className="py-2 pr-3 text-right font-medium">Total</th>
            <th className="hidden py-2 text-right font-medium sm:table-cell">Realized</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {newestFirst.map((t) => (
            <tr key={t.id}>
              <td className="py-2.5 pr-3 text-xs whitespace-nowrap text-muted">
                {new Date(t.timestamp).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
              </td>
              <td className="py-2.5 pr-3">
                <span
                  className={`mr-1.5 rounded px-1.5 py-0.5 text-[10px] font-bold uppercase ${
                    t.side === "buy" ? "bg-up-soft text-up" : "bg-down-soft text-down"
                  }`}
                >
                  {t.side}
                </span>
                <span className="tabular">{formatShares(t.shares)}</span> <span className="font-semibold">{t.symbol}</span>
                {t.source === "chat" && <span className="ml-1.5 text-xs text-muted" title="Placed via Jarvis chat">· via chat</span>}
              </td>
              <td className="tabular hidden py-2.5 pr-3 text-right sm:table-cell">{formatMoney(t.price)}</td>
              <td className="tabular py-2.5 pr-3 text-right">{formatMoney(t.total)}</td>
              <td className="tabular hidden py-2.5 text-right sm:table-cell">
                {t.realizedPnl === null ? <span className="text-muted">—</span> : formatSignedMoney(t.realizedPnl)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
