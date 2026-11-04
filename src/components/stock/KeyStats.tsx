import { formatCompactMoney, formatCompactNumber, formatMoney, formatNumber } from "@/lib/format";
import type { Quote } from "@/lib/types";

function RangeBar({ low, high, value, currency }: { low: number; high: number; value: number; currency: string }) {
  const pct = high > low ? Math.min(100, Math.max(0, ((value - low) / (high - low)) * 100)) : 50;
  return (
    <div>
      <div className="tabular flex justify-between text-sm font-medium">
        <span>{formatMoney(low, currency)}</span>
        <span>{formatMoney(high, currency)}</span>
      </div>
      <div className="relative mt-2 h-1.5 rounded-full bg-surface-2" aria-hidden>
        <div className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-surface bg-accent" style={{ left: `${pct}%` }} />
      </div>
      <p className="sr-only">Current price is {pct.toFixed(0)}% of the way from the low to the high.</p>
    </div>
  );
}

/** Key numbers for a stock, straight from the quote. Missing values show "—". */
export function KeyStats({ quote }: { quote: Quote }) {
  const c = quote.currency;
  const stats: { label: string; value: string }[] = [
    { label: "Market cap", value: formatCompactMoney(quote.marketCap, c) },
    { label: "P/E (TTM)", value: formatNumber(quote.trailingPE) },
    { label: "Forward P/E", value: formatNumber(quote.forwardPE) },
    { label: "Volume", value: formatCompactNumber(quote.volume) },
    { label: "Avg volume (3M)", value: formatCompactNumber(quote.averageVolume) },
    { label: "Prev. close", value: quote.previousClose !== null ? formatMoney(quote.previousClose, c) : "—" },
  ];

  return (
    <div className="grid gap-4">
      <dl className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3">
        {stats.map((s) => (
          <div key={s.label}>
            <dt className="text-xs text-muted">{s.label}</dt>
            <dd className="tabular text-sm font-semibold">{s.value}</dd>
          </div>
        ))}
      </dl>
      {quote.dayLow !== null && quote.dayHigh !== null && (
        <div>
          <p className="mb-1 text-xs text-muted">Day range</p>
          <RangeBar low={quote.dayLow} high={quote.dayHigh} value={quote.price} currency={c} />
        </div>
      )}
      {quote.fiftyTwoWeekLow !== null && quote.fiftyTwoWeekHigh !== null && (
        <div>
          <p className="mb-1 text-xs text-muted">52-week range</p>
          <RangeBar low={quote.fiftyTwoWeekLow} high={quote.fiftyTwoWeekHigh} value={quote.price} currency={c} />
        </div>
      )}
    </div>
  );
}
