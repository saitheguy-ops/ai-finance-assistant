import { z } from "zod";

import { isMarketDataError } from "@/lib/market/errors";
import type { MarketDataProvider } from "@/lib/market/provider";
import { normalizeSymbol } from "@/lib/market/symbols";
import {
  executeTrade,
  summarizePortfolio,
  type Portfolio,
  type Trade,
  type TradeSide,
} from "@/lib/portfolio";
import { RANGES, type PricePoint } from "@/lib/types";
import type { ChatWidget } from "./types";

/**
 * The six functions the assistant can call. Both chat modes use this exact
 * code path:
 *  - basic mode: the command parser decides which tool to call
 *  - AI mode: Claude decides, via tool use
 * Either way, every number in a reply comes from here, i.e. from real market
 * data, never from the language model's memory.
 */

export const TOOL_NAMES = ["get_quote", "get_history", "compare", "buy", "sell", "get_portfolio"] as const;
export type ToolName = (typeof TOOL_NAMES)[number];

const symbolSchema = z
  .string()
  .transform((s, ctx) => {
    const n = normalizeSymbol(s);
    if (!n) ctx.addIssue({ code: "custom", message: `"${s}" isn't a valid ticker symbol.` });
    return n ?? "";
  });
const rangeSchema = z.enum(RANGES);
const sharesSchema = z.number().int("Shares must be a whole number.").positive("Shares must be greater than zero.");

export const toolInputSchemas = {
  get_quote: z.object({ symbol: symbolSchema }),
  get_history: z.object({ symbol: symbolSchema, range: rangeSchema }),
  compare: z.object({
    symbols: z.array(symbolSchema).min(2, "Compare needs at least two tickers.").max(4, "Compare up to four tickers at a time."),
    range: rangeSchema,
  }),
  buy: z.object({ symbol: symbolSchema, shares: sharesSchema }),
  sell: z.object({ symbol: symbolSchema, shares: sharesSchema }),
  get_portfolio: z.object({}),
} satisfies Record<ToolName, z.ZodType>;

/** JSON Schemas sent to Claude. Kept in sync with the zod schemas above (see tools.test.ts). */
export const TOOL_DEFINITIONS: {
  name: ToolName;
  description: string;
  input_schema: { type: "object"; properties: Record<string, unknown>; required: string[]; additionalProperties: false };
}[] = [
  {
    name: "get_quote",
    description:
      "Get the latest real-time-ish quote for one ticker: price, today's change, market cap, P/E, 52-week range, volume. Use for any question about a current price.",
    input_schema: {
      type: "object",
      properties: { symbol: { type: "string", description: "Ticker symbol, e.g. AAPL, BRK-B, BTC-USD, ^GSPC" } },
      required: ["symbol"],
      additionalProperties: false,
    },
  },
  {
    name: "get_history",
    description:
      "Get price performance for one ticker over a range: start/end price, change, % change, high and low. Use for questions like 'how did NVDA do this month'. 1D=today's session, 1W=week, 1M=month, 1Y=year, 5Y=five years.",
    input_schema: {
      type: "object",
      properties: {
        symbol: { type: "string", description: "Ticker symbol" },
        range: { type: "string", enum: [...RANGES] },
      },
      required: ["symbol", "range"],
      additionalProperties: false,
    },
  },
  {
    name: "compare",
    description:
      "Compare 2-4 tickers side by side: current price, % change over the range, market cap and trailing P/E.",
    input_schema: {
      type: "object",
      properties: {
        symbols: { type: "array", items: { type: "string" }, description: "2 to 4 ticker symbols" },
        range: { type: "string", enum: [...RANGES] },
      },
      required: ["symbols", "range"],
      additionalProperties: false,
    },
  },
  {
    name: "buy",
    description:
      "Buy whole shares in the user's PAPER (fake money) portfolio at the current market price. Only call when the user explicitly asks to buy a specific quantity.",
    input_schema: {
      type: "object",
      properties: {
        symbol: { type: "string", description: "Ticker symbol" },
        shares: { type: "integer", description: "Whole number of shares, greater than 0" },
      },
      required: ["symbol", "shares"],
      additionalProperties: false,
    },
  },
  {
    name: "sell",
    description:
      "Sell whole shares from the user's PAPER (fake money) portfolio at the current market price. Only call when the user explicitly asks to sell a specific quantity.",
    input_schema: {
      type: "object",
      properties: {
        symbol: { type: "string", description: "Ticker symbol" },
        shares: { type: "integer", description: "Whole number of shares, greater than 0" },
      },
      required: ["symbol", "shares"],
      additionalProperties: false,
    },
  },
  {
    name: "get_portfolio",
    description:
      "Get the user's paper portfolio: cash, holdings with live prices, cost basis, unrealized and total P&L versus the $100,000 starting balance.",
    input_schema: { type: "object", properties: {}, required: [], additionalProperties: false },
  },
];

export type ToolOutcome = { ok: true; data: Record<string, unknown> } | { ok: false; error: string };

const round = (n: number, d = 2) => Math.round(n * 10 ** d) / 10 ** d;

/** Reduces a long price series to at most `max` evenly spaced points (keeps the last). */
export function downsample(points: PricePoint[], max = 120): PricePoint[] {
  if (points.length <= max) return points;
  const step = (points.length - 1) / (max - 1);
  return Array.from({ length: max }, (_, i) => points[Math.round(i * step)]);
}

function historyStats(points: PricePoint[]) {
  const start = points[0].c;
  const end = points[points.length - 1].c;
  const closes = points.map((p) => p.c);
  return {
    start,
    end,
    change: end - start,
    changePercent: ((end - start) / start) * 100,
    high: Math.max(...closes),
    low: Math.min(...closes),
  };
}

/**
 * Creates a toolbox bound to one market-data provider and one portfolio
 * snapshot. Trades update the toolbox's private copy, so "buy 10 then show my
 * portfolio" in a single conversation turn sees the new position.
 */
export function createToolbox(provider: MarketDataProvider, portfolio: Portfolio) {
  let current = portfolio;
  const trades: Trade[] = [];
  const widgets: ChatWidget[] = [];

  async function trade(side: TradeSide, symbol: string, shares: number): Promise<ToolOutcome> {
    const quote = await provider.getQuote(symbol);
    const result = executeTrade(current, { side, symbol, shares, price: quote.price, source: "chat" });
    if (!result.ok) return { ok: false, error: result.error };
    current = result.portfolio;
    trades.push(result.trade);
    widgets.push({ kind: "trade", trade: result.trade });
    return {
      ok: true,
      data: {
        executed: true,
        paper_trade: true,
        side,
        symbol: result.trade.symbol,
        shares,
        fill_price: result.trade.price,
        total: result.trade.total,
        realized_pnl: result.trade.realizedPnl,
        cash_after: current.cash,
        shares_now_held: current.positions[result.trade.symbol]?.shares ?? 0,
      },
    };
  }

  const handlers: { [K in ToolName]: (input: z.infer<(typeof toolInputSchemas)[K]>) => Promise<ToolOutcome> } = {
    async get_quote({ symbol }) {
      const q = await provider.getQuote(symbol);
      widgets.push({ kind: "quote", quote: q });
      return {
        ok: true,
        data: {
          symbol: q.symbol,
          name: q.name,
          price: q.price,
          currency: q.currency,
          change_today: round(q.change),
          change_today_percent: round(q.changePercent),
          previous_close: q.previousClose,
          market_cap: q.marketCap,
          trailing_pe: q.trailingPE === null ? null : round(q.trailingPE),
          forward_pe: q.forwardPE === null ? null : round(q.forwardPE),
          fifty_two_week_low: q.fiftyTwoWeekLow,
          fifty_two_week_high: q.fiftyTwoWeekHigh,
          volume: q.volume,
          market_state: q.marketState,
          as_of: q.asOf,
        },
      };
    },

    async get_history({ symbol, range }) {
      const h = await provider.getHistory(symbol, range);
      const s = historyStats(h.points);
      widgets.push({ kind: "history", symbol: h.symbol, range, currency: h.currency, points: downsample(h.points), ...s });
      return {
        ok: true,
        data: {
          symbol: h.symbol,
          range,
          currency: h.currency,
          from: new Date(h.points[0].t).toISOString(),
          to: new Date(h.points[h.points.length - 1].t).toISOString(),
          start_price: round(s.start),
          end_price: round(s.end),
          change: round(s.change),
          change_percent: round(s.changePercent),
          high: round(s.high),
          low: round(s.low),
          data_points: h.points.length,
        },
      };
    },

    async compare({ symbols, range }) {
      const unique = [...new Set(symbols)];
      if (unique.length < 2) return { ok: false, error: "Compare needs two different tickers." };
      const quotes = await provider.getQuotes(unique);
      const missing = unique.filter((s) => !quotes.some((q) => q.symbol === s));
      if (missing.length) return { ok: false, error: `Couldn't find: ${missing.join(", ")}.` };
      const histories = await Promise.all(unique.map((s) => provider.getHistory(s, range).catch(() => null)));

      const rows = quotes.map((q, i) => {
        const h = histories[i];
        const stats = h && h.points.length > 1 ? historyStats(h.points) : null;
        return {
          symbol: q.symbol,
          name: q.name,
          price: q.price,
          currency: q.currency,
          rangeChangePercent: stats ? stats.changePercent : null,
          marketCap: q.marketCap,
          trailingPE: q.trailingPE,
        };
      });
      const series = histories.flatMap((h, i) => {
        if (!h || h.points.length < 2) return [];
        const base = h.points[0].c;
        return [{ symbol: unique[i], points: downsample(h.points).map((p) => ({ t: p.t, c: ((p.c - base) / base) * 100 })) }];
      });
      widgets.push({ kind: "compare", range, rows, series });
      return {
        ok: true,
        data: {
          range,
          comparison: rows.map((r) => ({
            symbol: r.symbol,
            name: r.name,
            price: r.price,
            currency: r.currency,
            change_percent_over_range: r.rangeChangePercent === null ? null : round(r.rangeChangePercent),
            market_cap: r.marketCap,
            trailing_pe: r.trailingPE === null ? null : round(r.trailingPE),
          })),
        },
      };
    },

    buy: ({ symbol, shares }) => trade("buy", symbol, shares),
    sell: ({ symbol, shares }) => trade("sell", symbol, shares),

    async get_portfolio() {
      const symbols = Object.keys(current.positions);
      let prices: Record<string, number> = {};
      let priceNote: string | null = null;
      if (symbols.length) {
        try {
          const quotes = await provider.getQuotes(symbols);
          prices = Object.fromEntries(quotes.map((q) => [q.symbol, q.price]));
        } catch {
          priceNote = "Live prices are unavailable; holdings are valued at cost.";
        }
      }
      const summary = summarizePortfolio(current, prices);
      widgets.push({ kind: "portfolio", summary });
      return {
        ok: true,
        data: {
          paper_portfolio: true,
          starting_cash: current.startingCash,
          cash: summary.cash,
          holdings_value: summary.holdingsValue,
          total_value: summary.totalValue,
          total_pnl: summary.totalPnl,
          total_pnl_percent: round(summary.totalPnlPercent),
          realized_pnl: summary.realizedPnl,
          holdings: summary.holdings.map((h) => ({
            symbol: h.symbol,
            shares: h.shares,
            avg_cost: round(h.avgCost),
            price: h.price,
            market_value: h.marketValue,
            unrealized_pnl: h.unrealizedPnl,
            unrealized_pnl_percent: h.unrealizedPnlPercent === null ? null : round(h.unrealizedPnlPercent),
          })),
          trade_count: current.trades.length,
          note: priceNote ?? (summary.hasMissingPrices ? "Some holdings have no live price and are valued at cost." : null),
        },
      };
    },
  };

  /** Validates input, runs the tool, and converts every failure into a friendly error. */
  async function run(name: string, input: unknown): Promise<ToolOutcome> {
    if (!(TOOL_NAMES as readonly string[]).includes(name)) return { ok: false, error: `Unknown tool "${name}".` };
    const toolName = name as ToolName;
    const parsed = toolInputSchemas[toolName].safeParse(input ?? {});
    if (!parsed.success) return { ok: false, error: parsed.error.issues.map((i) => i.message).join(" ") };
    try {
      // The cast is safe: `parsed.data` was produced by the schema for `toolName`.
      return await (handlers[toolName] as (i: unknown) => Promise<ToolOutcome>)(parsed.data);
    } catch (err) {
      if (isMarketDataError(err)) return { ok: false, error: err.message };
      console.error(`[chat] tool ${name} failed:`, err);
      return { ok: false, error: "That lookup failed unexpectedly. Please try again." };
    }
  }

  return {
    run,
    get trades() {
      return trades;
    },
    get widgets() {
      return widgets;
    },
    get portfolio() {
      return current;
    },
  };
}

export type Toolbox = ReturnType<typeof createToolbox>;

