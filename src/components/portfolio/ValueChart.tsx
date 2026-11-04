"use client";

import { Area, AreaChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import useSWR from "swr";

import { evenTicks, formatTick, formatTooltipDate } from "@/components/stock/chart-format";
import { EmptyState, Skeleton } from "@/components/ui/States";
import { fetchJson } from "@/lib/client/fetcher";
import { formatMoney } from "@/lib/format";
import { rangeCovering } from "@/lib/market/ranges";
import { computeValueSeries, type Portfolio } from "@/lib/portfolio";
import type { PriceHistory, PricePoint, Range } from "@/lib/types";

/** Fetches price history for each symbol; a symbol that fails is simply skipped. */
async function loadHistories([, symbols, range]: [string, string[], Range]) {
  const results = await Promise.allSettled(
    symbols.map((s) => fetchJson<PriceHistory>(`/api/history?symbol=${encodeURIComponent(s)}&range=${range}`)),
  );
  const out: Record<string, PricePoint[]> = {};
  results.forEach((r, i) => {
    if (r.status === "fulfilled") out[symbols[i]] = r.value.points;
  });
  return out;
}

/**
 * "Total value over time", rebuilt from the trade log and real historical
 * prices (see computeValueSeries). The dashed line is the $100k start.
 */
export function ValueChart({ portfolio, livePrices }: { portfolio: Portfolio; livePrices: Record<string, number> }) {
  const first = portfolio.trades[0];
  const range: Range = first ? rangeCovering(Date.parse(first.timestamp)) : "1D";
  const symbols = [...new Set(portfolio.trades.map((t) => t.symbol))].sort();
  const { data: histories, isLoading } = useSWR(
    symbols.length ? (["value-series", symbols, range] as [string, string[], Range]) : null,
    loadHistories,
    { refreshInterval: 5 * 60_000, keepPreviousData: true },
  );

  if (!first) return <EmptyState>Make your first trade to start tracking value over time.</EmptyState>;
  if (isLoading && !histories) return <Skeleton className="h-56 w-full" />;

  const series = computeValueSeries(portfolio, histories ?? {}, livePrices);
  if (series.length < 2) {
    return <EmptyState>Not enough price history yet. Check back after the market moves.</EmptyState>;
  }

  return (
    <div className="h-56 sm:h-64">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={series} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id="valueFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--series-1)" stopOpacity={0.25} />
              <stop offset="100%" stopColor="var(--series-1)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="t"
            type="number"
            scale="time"
            domain={["dataMin", "dataMax"]}
            ticks={evenTicks(series)}
            tickFormatter={(t: number) => formatTick(t, range)}
            tick={{ fill: "var(--text-muted)", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            dataKey="c"
            domain={["auto", "auto"]}
            orientation="right"
            width={64}
            tickFormatter={(v: number) => `$${(v / 1000).toFixed(1)}k`}
            tick={{ fill: "var(--text-muted)", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
          />
          <ReferenceLine y={portfolio.startingCash} stroke="var(--text-muted)" strokeDasharray="4 4" strokeOpacity={0.6} />
          <Tooltip
            cursor={{ stroke: "var(--text-muted)", strokeDasharray: "3 3" }}
            contentStyle={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              color: "var(--text)",
              fontSize: 12,
            }}
            labelFormatter={(t) => formatTooltipDate(Number(t), range)}
            formatter={(v) => [formatMoney(Number(v)), "Total value"]}
          />
          <Area
            type="monotone"
            dataKey="c"
            stroke="var(--series-1)"
            strokeWidth={2}
            fill="url(#valueFill)"
            isAnimationActive={false}
            activeDot={{ r: 4, stroke: "var(--surface)", strokeWidth: 2 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
