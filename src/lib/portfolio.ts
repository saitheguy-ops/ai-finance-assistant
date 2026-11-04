import { normalizeSymbol } from "@/lib/market/symbols";
import type { PricePoint } from "@/lib/types";

/**
 * The paper-trading engine. Everything here is a pure function: it takes a
 * portfolio and returns a new one, never touching storage or the network.
 * That lets the browser (localStorage) and the server (chat tools) share the
 * exact same rules, and makes the logic easy to unit test.
 *
 * Accounting uses the average-cost method: a position tracks its total cost,
 * and selling part of it removes a proportional slice of that cost.
 */

export const STARTING_CASH = 100_000;
export const MAX_SHARES_PER_TRADE = 1_000_000;

export type TradeSide = "buy" | "sell";
export type TradeSource = "manual" | "chat";

export interface Position {
  symbol: string;
  shares: number;
  /** Total amount paid for the shares still held. */
  costBasis: number;
}

export interface Trade {
  id: string;
  symbol: string;
  side: TradeSide;
  shares: number;
  price: number;
  total: number;
  /** Profit/loss locked in by a sell; null for buys. */
  realizedPnl: number | null;
  timestamp: string;
  source: TradeSource;
}

export interface Portfolio {
  version: 1;
  startingCash: number;
  cash: number;
  positions: Record<string, Position>;
  trades: Trade[];
  createdAt: string;
}

export interface TradeRequest {
  symbol: string;
  side: TradeSide;
  shares: number;
  price: number;
  source?: TradeSource;
  /** Injectable for tests and for replaying a trade decided on the server. */
  id?: string;
  timestamp?: string;
}

export type TradeResult = { ok: true; portfolio: Portfolio; trade: Trade } | { ok: false; error: string };

/** Rounds to cents so floating-point dust never accumulates in cash. */
export const roundCents = (n: number) => Math.round(n * 100) / 100;

const newId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

export function createPortfolio(now = new Date()): Portfolio {
  return {
    version: 1,
    startingCash: STARTING_CASH,
    cash: STARTING_CASH,
    positions: {},
    trades: [],
    createdAt: now.toISOString(),
  };
}

/** Validates a trade and, if it's allowed, returns the updated portfolio. */
export function executeTrade(portfolio: Portfolio, req: TradeRequest): TradeResult {
  const symbol = normalizeSymbol(req.symbol);
  if (!symbol) return { ok: false, error: `"${req.symbol}" isn't a valid ticker.` };
  if (!Number.isInteger(req.shares) || req.shares <= 0) {
    return { ok: false, error: "Share count must be a whole number greater than zero." };
  }
  if (req.shares > MAX_SHARES_PER_TRADE) {
    return { ok: false, error: `That's more than the ${MAX_SHARES_PER_TRADE.toLocaleString()} share limit per trade.` };
  }
  if (!Number.isFinite(req.price) || req.price <= 0) {
    return { ok: false, error: `No valid price is available for ${symbol}.` };
  }

  const total = roundCents(req.shares * req.price);
  const existing = portfolio.positions[symbol];
  const positions = { ...portfolio.positions };
  let cash = portfolio.cash;
  let realizedPnl: number | null = null;

  if (req.side === "buy") {
    if (total > cash + 1e-9) {
      const affordable = Math.floor(cash / req.price);
      return {
        ok: false,
        error: `Not enough cash: ${req.shares} ${symbol} costs $${total.toFixed(2)} but you have $${cash.toFixed(2)}. You can afford ${affordable} share${affordable === 1 ? "" : "s"}.`,
      };
    }
    cash = roundCents(cash - total);
    positions[symbol] = {
      symbol,
      shares: (existing?.shares ?? 0) + req.shares,
      costBasis: roundCents((existing?.costBasis ?? 0) + total),
    };
  } else {
    const held = existing?.shares ?? 0;
    if (req.shares > held) {
      return {
        ok: false,
        error: held === 0 ? `You don't own any ${symbol}.` : `You only own ${held} share${held === 1 ? "" : "s"} of ${symbol}.`,
      };
    }
    const costRemoved = roundCents(existing.costBasis * (req.shares / held));
    realizedPnl = roundCents(total - costRemoved);
    cash = roundCents(cash + total);
    if (req.shares === held) {
      delete positions[symbol];
    } else {
      positions[symbol] = { symbol, shares: held - req.shares, costBasis: roundCents(existing.costBasis - costRemoved) };
    }
  }

  const trade: Trade = {
    id: req.id ?? newId(),
    symbol,
    side: req.side,
    shares: req.shares,
    price: req.price,
    total,
    realizedPnl,
    timestamp: req.timestamp ?? new Date().toISOString(),
    source: req.source ?? "manual",
  };

  return { ok: true, trade, portfolio: { ...portfolio, cash, positions, trades: [...portfolio.trades, trade] } };
}

/** Re-applies trades decided elsewhere (e.g. by the chat on the server). */
export function applyTrades(portfolio: Portfolio, trades: Trade[]): { portfolio: Portfolio; errors: string[] } {
  let current = portfolio;
  const errors: string[] = [];
  for (const t of trades) {
    if (current.trades.some((existing) => existing.id === t.id)) continue; // already applied
    const result = executeTrade(current, t);
    if (result.ok) current = result.portfolio;
    else errors.push(result.error);
  }
  return { portfolio: current, errors };
}

export interface Holding {
  symbol: string;
  shares: number;
  avgCost: number;
  costBasis: number;
  /** Null when we couldn't get a live price. */
  price: number | null;
  marketValue: number | null;
  unrealizedPnl: number | null;
  unrealizedPnlPercent: number | null;
  weight: number | null;
}

export interface PortfolioSummary {
  cash: number;
  holdingsValue: number;
  totalValue: number;
  totalPnl: number;
  totalPnlPercent: number;
  realizedPnl: number;
  holdings: Holding[];
  /** True if any holding is valued at cost because its live price is missing. */
  hasMissingPrices: boolean;
}

/**
 * Values the portfolio with live prices. If a price is missing we fall back
 * to cost basis for the totals (and flag it) rather than inventing a number.
 */
export function summarizePortfolio(portfolio: Portfolio, prices: Record<string, number | undefined>): PortfolioSummary {
  let holdingsValue = 0;
  let hasMissingPrices = false;
  const base = Object.values(portfolio.positions).map((p) => {
    const price = prices[p.symbol];
    const marketValue = typeof price === "number" ? roundCents(p.shares * price) : null;
    if (marketValue === null) hasMissingPrices = true;
    holdingsValue += marketValue ?? p.costBasis;
    return { p, price: price ?? null, marketValue };
  });

  const totalValue = roundCents(portfolio.cash + holdingsValue);
  const holdings: Holding[] = base
    .map(({ p, price, marketValue }) => ({
      symbol: p.symbol,
      shares: p.shares,
      avgCost: p.costBasis / p.shares,
      costBasis: p.costBasis,
      price,
      marketValue,
      unrealizedPnl: marketValue === null ? null : roundCents(marketValue - p.costBasis),
      unrealizedPnlPercent: marketValue === null || p.costBasis === 0 ? null : ((marketValue - p.costBasis) / p.costBasis) * 100,
      weight: marketValue === null || totalValue === 0 ? null : (marketValue / totalValue) * 100,
    }))
    .sort((a, b) => (b.marketValue ?? b.costBasis) - (a.marketValue ?? a.costBasis));

  const totalPnl = roundCents(totalValue - portfolio.startingCash);
  return {
    cash: portfolio.cash,
    holdingsValue: roundCents(holdingsValue),
    totalValue,
    totalPnl,
    totalPnlPercent: (totalPnl / portfolio.startingCash) * 100,
    realizedPnl: roundCents(portfolio.trades.reduce((sum, t) => sum + (t.realizedPnl ?? 0), 0)),
    holdings,
    hasMissingPrices,
  };
}

/**
 * Rebuilds "total value over time" from the trade log plus real historical
 * prices. For every timestamp in the price histories (from the first trade
 * onward) we replay the trades made up to that moment and value the shares at
 * the most recent close. A final point uses live prices.
 */
export function computeValueSeries(
  portfolio: Portfolio,
  histories: Record<string, PricePoint[]>,
  livePrices: Record<string, number | undefined> = {},
  now = Date.now(),
): PricePoint[] {
  const trades = [...portfolio.trades].sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp));
  if (trades.length === 0) return [];
  const start = Date.parse(trades[0].timestamp);

  const times = new Set<number>([start]);
  for (const points of Object.values(histories)) {
    for (const p of points) if (p.t >= start && p.t <= now) times.add(p.t);
  }
  const timeline = [...times].sort((a, b) => a - b);

  let cash = portfolio.startingCash;
  const shares: Record<string, number> = {};
  const lastPrice: Record<string, number> = {};
  const lastPriceAt: Record<string, number> = {};
  const histIdx: Record<string, number> = {};
  let tradeIdx = 0;
  const series: PricePoint[] = [];

  for (const t of timeline) {
    // Use whichever is newer for each symbol: the last price bar or the last fill.
    for (const [symbol, points] of Object.entries(histories)) {
      let i = histIdx[symbol] ?? 0;
      while (i < points.length && points[i].t <= t) {
        if (points[i].t >= (lastPriceAt[symbol] ?? -Infinity)) {
          lastPrice[symbol] = points[i].c;
          lastPriceAt[symbol] = points[i].t;
        }
        i++;
      }
      histIdx[symbol] = i;
    }
    while (tradeIdx < trades.length && Date.parse(trades[tradeIdx].timestamp) <= t) {
      const tr = trades[tradeIdx++];
      const at = Date.parse(tr.timestamp);
      cash += tr.side === "buy" ? -tr.total : tr.total;
      shares[tr.symbol] = (shares[tr.symbol] ?? 0) + (tr.side === "buy" ? tr.shares : -tr.shares);
      if (at >= (lastPriceAt[tr.symbol] ?? -Infinity)) {
        lastPrice[tr.symbol] = tr.price;
        lastPriceAt[tr.symbol] = at;
      }
    }
    series.push({ t, c: roundCents(valueAt(cash, shares, lastPrice)) });
  }

  // Apply any trades newer than the last history point, then add a live "now" point.
  while (tradeIdx < trades.length) {
    const tr = trades[tradeIdx++];
    cash += tr.side === "buy" ? -tr.total : tr.total;
    shares[tr.symbol] = (shares[tr.symbol] ?? 0) + (tr.side === "buy" ? tr.shares : -tr.shares);
    lastPrice[tr.symbol] = tr.price;
  }
  for (const [symbol, price] of Object.entries(livePrices)) if (typeof price === "number") lastPrice[symbol] = price;
  if (now > timeline[timeline.length - 1]) series.push({ t: now, c: roundCents(valueAt(cash, shares, lastPrice)) });

  return series;
}

function valueAt(cash: number, shares: Record<string, number>, prices: Record<string, number>): number {
  let v = cash;
  for (const [symbol, n] of Object.entries(shares)) if (n > 0) v += n * (prices[symbol] ?? 0);
  return v;
}

/** Checks data loaded from localStorage; returns null if it's not a valid portfolio. */
export function parsePortfolio(raw: unknown): Portfolio | null {
  if (!raw || typeof raw !== "object") return null;
  const p = raw as Partial<Portfolio>;
  if (p.version !== 1 || typeof p.cash !== "number" || typeof p.startingCash !== "number") return null;
  if (!p.positions || typeof p.positions !== "object" || !Array.isArray(p.trades)) return null;
  if (typeof p.createdAt !== "string") return null;
  for (const pos of Object.values(p.positions)) {
    if (!pos || typeof pos.symbol !== "string" || typeof pos.shares !== "number" || typeof pos.costBasis !== "number") {
      return null;
    }
  }
  const tradesOk = p.trades.every(
    (t) =>
      t &&
      typeof t.id === "string" &&
      typeof t.symbol === "string" &&
      (t.side === "buy" || t.side === "sell") &&
      typeof t.shares === "number" &&
      typeof t.price === "number" &&
      typeof t.total === "number" &&
      typeof t.timestamp === "string",
  );
  return tradesOk ? (p as Portfolio) : null;
}
