"use client";

import { useState } from "react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import useSWR from "swr";

import { PriceChange } from "@/components/ui/PriceChange";
import { ErrorNotice, Skeleton } from "@/components/ui/States";
import { errorMessage, fetchJson } from "@/lib/client/fetcher";
import { formatMoney } from "@/lib/format";
import type { PriceHistory, Range } from "@/lib/types";
import { evenTicks, formatTick, formatTooltipDate } from "./chart-format";
import { RangeTabs } from "./RangeTabs";

/** Area chart of closing prices with a range switcher and hover tooltip. */
export function PriceChart({ symbol, currency = "USD" }: { symbol: string; currency?: string }) {
  const [range, setRange] = useState<Range>("1M");
  const { data, error, isLoading, mutate } = useSWR(
    `/api/history?symbol=${encodeURIComponent(symbol)}&range=${range}`,
    (url: string) => fetchJson<PriceHistory>(url),
    { keepPreviousData: true, refreshInterval: range === "1D" ? 60_000 : 0 },
  );

  const points = data?.points ?? [];
  const first = points[0]?.c;
  const last = points[points.length - 1]?.c;
  const changePct = first && last ? ((last - first) / first) * 100 : null;

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <RangeTabs value={range} onChange={setRange} />
        {changePct !== null && first !== undefined && last !== undefined && (
          <span className="text-xs text-muted">
            {range} change: <PriceChange change={last - first} percent={changePct} currency={currency} />
          </span>
        )}
      </div>

      <div className="h-64 sm:h-80" aria-busy={isLoading}>
        {error && !data ? (
          <ErrorNotice message={errorMessage(error)} onRetry={() => void mutate()} />
        ) : points.length < 2 ? (
          <Skeleton className="h-full w-full" />
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={points} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="priceFill" x1="0" y1="0" x2="0" y2="1">
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
                ticks={evenTicks(points)}
                tickFormatter={(t: number) => formatTick(t, range)}
                tick={{ fill: "var(--text-muted)", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                dataKey="c"
                domain={["auto", "auto"]}
                orientation="right"
                width={56}
                tickFormatter={(v: number) => v.toLocaleString("en-US", { maximumFractionDigits: v < 10 ? 2 : 0 })}
                tick={{ fill: "var(--text-muted)", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
              />
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
                formatter={(v) => [formatMoney(Number(v), currency), "Close"]}
              />
              <Area
                type="monotone"
                dataKey="c"
                stroke="var(--series-1)"
                strokeWidth={2}
                fill="url(#priceFill)"
                isAnimationActive={false}
                activeDot={{ r: 4, stroke: "var(--surface)", strokeWidth: 2 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
