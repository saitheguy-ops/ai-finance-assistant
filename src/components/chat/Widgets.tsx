"use client";

import Link from "next/link";
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { PriceChange } from "@/components/ui/PriceChange";
import { Sparkline } from "@/components/ui/Sparkline";
import type { ChatWidget } from "@/lib/chat/types";
import { formatCompactMoney, formatMoney, formatNumber, formatPercent, formatShares, formatSignedMoney } from "@/lib/format";

const SERIES = ["var(--series-1)", "var(--series-2)", "var(--series-3)", "var(--series-4)"];

function Box({ children }: { children: React.ReactNode }) {
  return <div className="mt-2 rounded-xl border border-border bg-bg p-3 text-sm">{children}</div>;
}

function StockLink({ symbol }: { symbol: string }) {
  return (
    <Link href={`/stock/${encodeURIComponent(symbol)}`} className="font-semibold hover:text-accent">
      {symbol}
    </Link>
  );
}

/** Mini charts and cards rendered under a Jarvis reply. All data comes from tool results. */
export function WidgetView({ widget }: { widget: ChatWidget }) {
  switch (widget.kind) {
    case "quote": {
      const q = widget.quote;
      return (
        <Box>
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <StockLink symbol={q.symbol} />
              <p className="truncate text-xs text-muted">{q.name}</p>
            </div>
            <div className="text-right">
              <p className="tabular font-semibold">{formatMoney(q.price, q.currency)}</p>
              <PriceChange percent={q.changePercent} />
            </div>
          </div>
          <p className="tabular mt-2 text-xs text-muted">
            Mkt cap {formatCompactMoney(q.marketCap, q.currency)} · P/E {formatNumber(q.trailingPE)} · 52w{" "}
            {q.fiftyTwoWeekLow !== null && q.fiftyTwoWeekHigh !== null
              ? `${formatMoney(q.fiftyTwoWeekLow, q.currency)}–${formatMoney(q.fiftyTwoWeekHigh, q.currency)}`
              : "—"}
          </p>
        </Box>
      );
    }

    case "history":
      return (
        <Box>
          <div className="flex items-center justify-between">
            <span>
              <StockLink symbol={widget.symbol} /> <span className="text-xs text-muted">{widget.range}</span>
            </span>
            <PriceChange change={widget.change} percent={widget.changePercent} currency={widget.currency} />
          </div>
          <Sparkline points={widget.points} reference={widget.start} className="mt-2 h-16 w-full" width={300} height={64} label={`${widget.symbol} ${widget.range} price chart`} />
          <p className="tabular mt-1 flex justify-between text-xs text-muted">
            <span>Low {formatMoney(widget.low, widget.currency)}</span>
            <span>High {formatMoney(widget.high, widget.currency)}</span>
          </p>
        </Box>
      );

    case "compare":
      return (
        <Box>
          {widget.series.length >= 2 && (
            <div className="h-32">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                  <XAxis dataKey="t" type="number" domain={["dataMin", "dataMax"]} hide />
                  <YAxis
                    width={40}
                    tickFormatter={(v: number) => `${v.toFixed(0)}%`}
                    tick={{ fill: "var(--text-muted)", fontSize: 10 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 11 }}
                    labelFormatter={(t) => new Date(Number(t)).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    formatter={(v, name) => [formatPercent(Number(v)), name]}
                  />
                  {widget.series.map((s, i) => (
                    <Line key={s.symbol} data={s.points} dataKey="c" name={s.symbol} stroke={SERIES[i]} dot={false} strokeWidth={2} isAnimationActive={false} />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
          <table className="mt-2 w-full text-xs">
            <thead className="text-muted">
              <tr>
                <th className="text-left font-medium">Ticker</th>
                <th className="text-right font-medium">Price</th>
                <th className="text-right font-medium">{widget.range}</th>
                <th className="text-right font-medium">P/E</th>
              </tr>
            </thead>
            <tbody>
              {widget.rows.map((r, i) => (
                <tr key={r.symbol}>
                  <td className="py-1">
                    <span className="mr-1.5 inline-block h-2 w-2 rounded-full" style={{ background: SERIES[i] }} aria-hidden />
                    <StockLink symbol={r.symbol} />
                  </td>
                  <td className="tabular text-right">{formatMoney(r.price, r.currency)}</td>
                  <td className="text-right">{r.rangeChangePercent === null ? "—" : <PriceChange percent={r.rangeChangePercent} />}</td>
                  <td className="tabular text-right">{formatNumber(r.trailingPE, 1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Box>
      );

    case "trade": {
      const t = widget.trade;
      return (
        <Box>
          <div className="flex items-center justify-between">
            <span>
              <span className={`mr-1.5 rounded px-1.5 py-0.5 text-[10px] font-bold uppercase ${t.side === "buy" ? "bg-up-soft text-up" : "bg-down-soft text-down"}`}>
                {t.side}
              </span>
              {formatShares(t.shares)} <StockLink symbol={t.symbol} />
            </span>
            <span className="tabular font-semibold">{formatMoney(t.total)}</span>
          </div>
          <p className="tabular mt-1 text-xs text-muted">
            Filled at {formatMoney(t.price)}
            {t.realizedPnl !== null && ` · realized ${formatSignedMoney(t.realizedPnl)}`} · paper trade
          </p>
        </Box>
      );
    }

    case "portfolio": {
      const s = widget.summary;
      return (
        <Box>
          <div className="flex items-baseline justify-between">
            <span className="tabular text-base font-bold">{formatMoney(s.totalValue)}</span>
            <PriceChange change={s.totalPnl} percent={s.totalPnlPercent} />
          </div>
          <p className="tabular text-xs text-muted">Cash {formatMoney(s.cash)}</p>
          {s.holdings.length > 0 && (
            <ul className="mt-2 divide-y divide-border text-xs">
              {s.holdings.slice(0, 6).map((h) => (
                <li key={h.symbol} className="flex justify-between py-1">
                  <span>
                    <StockLink symbol={h.symbol} /> <span className="text-muted">× {formatShares(h.shares)}</span>
                  </span>
                  {h.unrealizedPnlPercent !== null ? <PriceChange percent={h.unrealizedPnlPercent} /> : <span className="text-muted">—</span>}
                </li>
              ))}
            </ul>
          )}
          <Link href="/portfolio" className="mt-2 inline-block text-xs font-medium text-accent hover:underline">
            Open portfolio →
          </Link>
        </Box>
      );
    }
  }
}
