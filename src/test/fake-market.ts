import { MarketDataError } from "@/lib/market/errors";
import type { MarketDataProvider } from "@/lib/market/provider";
import type { PriceHistory, Quote, Range } from "@/lib/types";

/**
 * Test double for the market-data layer. Prices here are test fixtures used
 * only by unit tests; the app itself only ever uses the Yahoo provider.
 */
export function fakeQuote(symbol: string, price: number, overrides: Partial<Quote> = {}): Quote {
  return {
    symbol,
    name: `${symbol} Test Co`,
    price,
    change: 1,
    changePercent: 1,
    previousClose: price - 1,
    currency: "USD",
    marketState: "REGULAR",
    asOf: "2026-11-03T20:00:00.000Z",
    marketCap: 1_000_000_000,
    trailingPE: 20,
    forwardPE: 18,
    fiftyTwoWeekLow: price * 0.5,
    fiftyTwoWeekHigh: price * 1.5,
    dayLow: price - 2,
    dayHigh: price + 2,
    volume: 1000,
    averageVolume: 2000,
    exchange: "TEST",
    quoteType: "EQUITY",
    ...overrides,
  };
}

export function createFakeMarket(prices: Record<string, number>, opts: { down?: boolean } = {}): MarketDataProvider {
  const check = () => {
    if (opts.down) throw new MarketDataError("UNAVAILABLE", "The market data source isn't responding right now.");
  };
  const quote = (s: string) => {
    check();
    if (!(s in prices)) throw new MarketDataError("NOT_FOUND", `Couldn't find a ticker called ${s}.`);
    return fakeQuote(s, prices[s]);
  };
  return {
    async getQuote(s) {
      return quote(s);
    },
    async getQuotes(symbols) {
      check();
      return symbols.filter((s) => s in prices).map((s) => fakeQuote(s, prices[s]));
    },
    async getHistory(symbol: string, range: Range): Promise<PriceHistory> {
      const end = quote(symbol).price;
      const start = end / 1.1; // always +10% over the range, for predictable assertions
      const t0 = Date.UTC(2026, 9, 1);
      return {
        symbol,
        range,
        currency: "USD",
        points: [
          { t: t0, c: start },
          { t: t0 + 86_400_000, c: end * 1.05 },
          { t: t0 + 2 * 86_400_000, c: end },
        ],
      };
    },
    async getNews() {
      check();
      return [];
    },
    async search() {
      check();
      return [];
    },
  };
}
