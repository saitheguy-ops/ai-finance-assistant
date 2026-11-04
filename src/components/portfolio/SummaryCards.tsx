import { PriceChange } from "@/components/ui/PriceChange";
import { formatMoney, formatSignedMoney } from "@/lib/format";
import type { PortfolioSummary } from "@/lib/portfolio";

function Stat({ label, value, sub }: { label: string; value: React.ReactNode; sub?: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-border bg-surface p-4">
      <p className="text-xs text-muted">{label}</p>
      <p className="tabular mt-1 text-xl font-bold sm:text-2xl">{value}</p>
      {sub && <div className="mt-1 text-xs text-muted">{sub}</div>}
    </div>
  );
}

export function SummaryCards({ summary, dayChange }: { summary: PortfolioSummary; dayChange: number | null }) {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <Stat
        label="Total value"
        value={formatMoney(summary.totalValue)}
        sub={<PriceChange change={summary.totalPnl} percent={summary.totalPnlPercent} />}
      />
      <Stat label="Cash" value={formatMoney(summary.cash)} sub="Available to trade" />
      <Stat label="Invested" value={formatMoney(summary.holdingsValue)} sub={`${summary.holdings.length} position${summary.holdings.length === 1 ? "" : "s"}`} />
      <Stat
        label="Today"
        value={dayChange === null ? "—" : formatSignedMoney(dayChange)}
        sub={`Realized P&L ${formatSignedMoney(summary.realizedPnl)}`}
      />
    </div>
  );
}
