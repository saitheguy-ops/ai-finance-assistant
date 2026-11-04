import { describe, expect, it } from "vitest";

import {
  STARTING_CASH,
  applyTrades,
  computeValueSeries,
  createPortfolio,
  executeTrade,
  parsePortfolio,
  summarizePortfolio,
  type Portfolio,
} from "./portfolio";

const T0 = "2026-11-02T15:00:00.000Z";

function buy(p: Portfolio, symbol: string, shares: number, price: number, timestamp = T0): Portfolio {
  const r = executeTrade(p, { symbol, side: "buy", shares, price, timestamp });
  if (!r.ok) throw new Error(r.error);
  return r.portfolio;
}

describe("executeTrade", () => {
  it("starts with $100,000 of fake cash", () => {
    expect(createPortfolio().cash).toBe(STARTING_CASH);
  });

  it("buys: deducts cash and builds cost basis", () => {
    const p = buy(createPortfolio(), "aapl", 10, 150.25);
    expect(p.cash).toBe(98_497.5);
    expect(p.positions.AAPL).toEqual({ symbol: "AAPL", shares: 10, costBasis: 1502.5 });
    expect(p.trades).toHaveLength(1);
    expect(p.trades[0]).toMatchObject({ side: "buy", total: 1502.5, realizedPnl: null });
  });

  it("averages cost across multiple buys", () => {
    let p = buy(createPortfolio(), "MSFT", 10, 100);
    p = buy(p, "MSFT", 10, 200);
    expect(p.positions.MSFT.shares).toBe(20);
    expect(p.positions.MSFT.costBasis).toBe(3000); // avg $150
  });

  it("sells: realizes P&L against average cost and keeps the remainder", () => {
    let p = buy(createPortfolio(), "MSFT", 10, 100);
    p = buy(p, "MSFT", 10, 200);
    const r = executeTrade(p, { symbol: "MSFT", side: "sell", shares: 5, price: 180 });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.trade.realizedPnl).toBe(150); // (180 - 150) * 5
    expect(r.portfolio.positions.MSFT).toEqual({ symbol: "MSFT", shares: 15, costBasis: 2250 });
    expect(r.portfolio.cash).toBe(STARTING_CASH - 3000 + 900);
  });

  it("removes the position when fully sold", () => {
    const p = buy(createPortfolio(), "TSLA", 3, 200);
    const r = executeTrade(p, { symbol: "TSLA", side: "sell", shares: 3, price: 190 });
    expect(r.ok && r.portfolio.positions.TSLA).toBe(undefined);
    expect(r.ok && r.trade.realizedPnl).toBe(-30);
  });

  it("rejects buying more than you can afford, and says how many you could buy", () => {
    const r = executeTrade(createPortfolio(), { symbol: "NVDA", side: "buy", shares: 1000, price: 150 });
    expect(r.ok).toBe(false);
    expect(!r.ok && r.error).toMatch(/Not enough cash.*afford 666 shares/);
  });

  it("rejects selling shares you don't own", () => {
    const r1 = executeTrade(createPortfolio(), { symbol: "NVDA", side: "sell", shares: 1, price: 150 });
    expect(!r1.ok && r1.error).toMatch(/don't own any NVDA/);
    const p = buy(createPortfolio(), "NVDA", 2, 150);
    const r2 = executeTrade(p, { symbol: "NVDA", side: "sell", shares: 5, price: 150 });
    expect(!r2.ok && r2.error).toMatch(/only own 2 shares/);
  });

  it("rejects bad input", () => {
    const p = createPortfolio();
    expect(executeTrade(p, { symbol: "NVDA", side: "buy", shares: 1.5, price: 10 }).ok).toBe(false);
    expect(executeTrade(p, { symbol: "NVDA", side: "buy", shares: -1, price: 10 }).ok).toBe(false);
    expect(executeTrade(p, { symbol: "NVDA", side: "buy", shares: 1, price: Number.NaN }).ok).toBe(false);
    expect(executeTrade(p, { symbol: "not a symbol", side: "buy", shares: 1, price: 10 }).ok).toBe(false);
  });

  it("never mutates the input portfolio", () => {
    const p = createPortfolio();
    const frozen = JSON.stringify(p);
    buy(p, "AAPL", 1, 100);
    expect(JSON.stringify(p)).toBe(frozen);
  });
});

describe("applyTrades", () => {
  it("replays trades and skips ones already applied (idempotent)", () => {
    const decided = buy(createPortfolio(), "AAPL", 2, 100).trades;
    const once = applyTrades(createPortfolio(), decided).portfolio;
    const twice = applyTrades(once, decided).portfolio;
    expect(twice.trades).toHaveLength(1);
    expect(twice.cash).toBe(STARTING_CASH - 200);
  });
});

describe("summarizePortfolio", () => {
  it("values holdings at live prices and computes P&L", () => {
    let p = buy(createPortfolio(), "AAPL", 10, 100);
    p = buy(p, "MSFT", 5, 200);
    const s = summarizePortfolio(p, { AAPL: 110, MSFT: 190 });
    expect(s.holdingsValue).toBe(1100 + 950);
    expect(s.totalValue).toBe(STARTING_CASH - 2000 + 2050);
    expect(s.totalPnl).toBe(50);
    const aapl = s.holdings.find((h) => h.symbol === "AAPL")!;
    expect(aapl.unrealizedPnl).toBe(100);
    expect(aapl.unrealizedPnlPercent).toBeCloseTo(10);
    expect(s.hasMissingPrices).toBe(false);
  });

  it("falls back to cost basis (and flags it) when a price is missing", () => {
    const p = buy(createPortfolio(), "AAPL", 10, 100);
    const s = summarizePortfolio(p, {});
    expect(s.totalValue).toBe(STARTING_CASH);
    expect(s.hasMissingPrices).toBe(true);
    expect(s.holdings[0].marketValue).toBeNull();
  });
});

describe("computeValueSeries", () => {
  it("replays trades over real price history", () => {
    const t0 = Date.parse(T0);
    const hour = 3600_000;
    const p = buy(createPortfolio(), "AAPL", 100, 100, T0);
    const series = computeValueSeries(
      p,
      { AAPL: [{ t: t0 - hour, c: 99 }, { t: t0 + hour, c: 101 }, { t: t0 + 2 * hour, c: 105 }] },
      { AAPL: 110 },
      t0 + 3 * hour,
    );
    expect(series.map((s) => s.c)).toEqual([100_000, 100_100, 100_500, 101_000]);
  });

  it("is empty before the first trade", () => {
    expect(computeValueSeries(createPortfolio(), {})).toEqual([]);
  });
});

describe("parsePortfolio", () => {
  it("accepts a valid portfolio and rejects junk", () => {
    const p = buy(createPortfolio(), "AAPL", 1, 1);
    expect(parsePortfolio(JSON.parse(JSON.stringify(p)))).toEqual(p);
    expect(parsePortfolio(null)).toBeNull();
    expect(parsePortfolio({ version: 2 })).toBeNull();
    expect(parsePortfolio({ ...p, trades: [{ id: 1 }] })).toBeNull();
  });
});
