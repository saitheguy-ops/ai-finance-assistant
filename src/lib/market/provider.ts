import type { NewsItem, PriceHistory, Quote, Range, SearchResult } from "@/lib/types";

/**
 * Everything the app needs from a market-data source. The real implementation
 * talks to Yahoo (see yahoo.ts); tests pass in a fake. Keeping this interface
 * small is what makes the chat tools testable without the network.
 */
export interface MarketDataProvider {
  getQuote(symbol: string): Promise<Quote>;
  getQuotes(symbols: string[]): Promise<Quote[]>;
  getHistory(symbol: string, range: Range): Promise<PriceHistory>;
  getNews(symbol: string, count?: number): Promise<NewsItem[]>;
  search(query: string): Promise<SearchResult[]>;
}
