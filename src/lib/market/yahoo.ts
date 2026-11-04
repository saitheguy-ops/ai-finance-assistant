import "server-only";

import YahooFinance from "yahoo-finance2";
import type { Quote as YahooQuote } from "yahoo-finance2/modules/quote";

import type { NewsItem, PriceHistory, PricePoint, Quote, Range, SearchResult } from "@/lib/types";
import { TtlCache } from "./cache";
import { MarketDataError } from "./errors";
import type { MarketDataProvider } from "./provider";
import { RANGE_CONFIG, lastSession } from "./ranges";

/**
 * The only file that talks to Yahoo Finance. It converts Yahoo's large,
 * loosely-typed responses into our small domain types (src/lib/types.ts),
 * caches results briefly, and turns every failure into a MarketDataError.
 */

const yf = new YahooFinance({
  suppressNotices: ["yahooSurvey"],
  versionCheck: false,
  queue: { concurrency: 4 },
});

const cache = new TtlCache();
const QUOTE_TTL = 15_000;
const NEWS_TTL = 10 * 60_000;
const SEARCH_TTL = 60 * 60_000;

/** Turns any thrown value from yahoo-finance2 into a MarketDataError. */
function toMarketError(err: unknown, symbol?: string): MarketDataError {
  if (err instanceof MarketDataError) return err;
  const message = err instanceof Error ? err.message : String(err);
  if (/not found|no data found|delisted|invalid symbol|no fundamentals/i.test(message)) {
    return new MarketDataError(
      "NOT_FOUND",
      symbol ? `Couldn't find a ticker called ${symbol}.` : "No matching data was found.",
      { cause: err },
    );
  }
  console.warn(`[market] Yahoo request failed${symbol ? ` for ${symbol}` : ""}: ${message}`);
  return new MarketDataError(
    "UNAVAILABLE",
    "The market data source isn't responding right now. Please try again in a minute.",
    { cause: err },
  );
}

const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);

function mapQuote(q: YahooQuote): Quote | null {
  const price = num(q.regularMarketPrice);
  if (price === null) return null;
  const previousClose = num(q.regularMarketPreviousClose);
  const change = num(q.regularMarketChange) ?? (previousClose !== null ? price - previousClose : 0);
  const changePercent =
    num(q.regularMarketChangePercent) ?? (previousClose ? (change / previousClose) * 100 : 0);

  return {
    symbol: q.symbol,
    name: q.longName ?? q.shortName ?? q.symbol,
    price,
    change,
    changePercent,
    previousClose,
    currency: q.currency ?? "USD",
    marketState: q.marketState ?? null,
    asOf: q.regularMarketTime ? new Date(q.regularMarketTime).toISOString() : null,
    marketCap: num(q.marketCap),
    trailingPE: num(q.trailingPE),
    forwardPE: num(q.forwardPE),
    fiftyTwoWeekLow: num(q.fiftyTwoWeekLow),
    fiftyTwoWeekHigh: num(q.fiftyTwoWeekHigh),
    dayLow: num(q.regularMarketDayLow),
    dayHigh: num(q.regularMarketDayHigh),
    volume: num(q.regularMarketVolume),
    averageVolume: num(q.averageDailyVolume3Month),
    exchange: q.fullExchangeName ?? q.exchange ?? null,
    quoteType: q.quoteType ?? null,
  };
}

async function fetchQuotes(symbols: string[]): Promise<Quote[]> {
  if (symbols.length === 0) return [];
  const key = `quotes:${[...symbols].sort().join(",")}`;
  return cache.get(key, QUOTE_TTL, async () => {
    let raw: YahooQuote[];
    try {
      raw = await yf.quote(symbols, { return: "array" });
    } catch (err) {
      throw toMarketError(err, symbols.length === 1 ? symbols[0] : undefined);
    }
    const bySymbol = new Map<string, Quote>();
    for (const q of raw) {
      const mapped = mapQuote(q);
      if (mapped) bySymbol.set(mapped.symbol.toUpperCase(), mapped);
    }
    // Preserve the caller's order; unknown symbols are simply absent.
    return symbols.map((s) => bySymbol.get(s)).filter((q): q is Quote => Boolean(q));
  });
}

async function fetchHistory(symbol: string, range: Range): Promise<PriceHistory> {
  const config = RANGE_CONFIG[range];
  return cache.get(`history:${symbol}:${range}`, config.ttlMs, async () => {
    try {
      const result = await yf.chart(symbol, {
        period1: new Date(Date.now() - config.lookbackMs),
        interval: config.interval,
        return: "array",
      });
      let points: PricePoint[] = result.quotes
        .filter((q) => typeof q.close === "number" && Number.isFinite(q.close))
        .map((q) => ({ t: new Date(q.date).getTime(), c: q.close as number }));
      if (range === "1D") points = lastSession(points, result.meta.gmtoffset ?? 0);
      if (points.length === 0) {
        throw new MarketDataError("NOT_FOUND", `No price history is available for ${symbol}.`);
      }
      return { symbol, range, currency: result.meta.currency ?? "USD", points };
    } catch (err) {
      throw toMarketError(err, symbol);
    }
  });
}

async function fetchNews(symbol: string, count = 8): Promise<NewsItem[]> {
  return cache.get(`news:${symbol}:${count}`, NEWS_TTL, async () => {
    try {
      const result = await yf.search(symbol, { quotesCount: 0, newsCount: count });
      return result.news.map((n) => ({
        id: n.uuid,
        title: n.title,
        publisher: n.publisher,
        link: n.link,
        publishedAt: new Date(n.providerPublishTime).toISOString(),
      }));
    } catch (err) {
      throw toMarketError(err, symbol);
    }
  });
}

async function searchSymbols(query: string): Promise<SearchResult[]> {
  return cache.get(`search:${query.toLowerCase()}`, SEARCH_TTL, async () => {
    try {
      const result = await yf.search(query, { quotesCount: 8, newsCount: 0 });
      const out: SearchResult[] = [];
      for (const q of result.quotes) {
        if (!("isYahooFinance" in q) || !q.isYahooFinance) continue;
        out.push({
          symbol: q.symbol,
          name: (typeof q.longname === "string" && q.longname) || (typeof q.shortname === "string" && q.shortname) || q.symbol,
          exchange: (typeof q.exchDisp === "string" && q.exchDisp) || q.exchange,
          type: typeof q.quoteType === "string" ? q.quoteType : "",
        });
      }
      return out;
    } catch (err) {
      throw toMarketError(err);
    }
  });
}

export const yahooProvider: MarketDataProvider = {
  async getQuote(symbol) {
    const [quote] = await fetchQuotes([symbol]);
    if (!quote) throw new MarketDataError("NOT_FOUND", `Couldn't find a ticker called ${symbol}.`);
    return quote;
  },
  getQuotes: fetchQuotes,
  getHistory: fetchHistory,
  getNews: fetchNews,
  search: searchSymbols,
};
