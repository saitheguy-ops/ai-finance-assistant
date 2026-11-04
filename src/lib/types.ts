/**
 * Shared domain types. These are deliberately independent of yahoo-finance2's
 * own types so the UI (and tests) never depend on the shape of a third-party
 * response. The market-data layer converts Yahoo data into these.
 */

export const RANGES = ["1D", "1W", "1M", "1Y", "5Y"] as const;
export type Range = (typeof RANGES)[number];

export interface Quote {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  previousClose: number | null;
  currency: string;
  marketState: string | null;
  /** ISO timestamp of the last trade Yahoo reported. */
  asOf: string | null;
  marketCap: number | null;
  trailingPE: number | null;
  forwardPE: number | null;
  fiftyTwoWeekLow: number | null;
  fiftyTwoWeekHigh: number | null;
  dayLow: number | null;
  dayHigh: number | null;
  volume: number | null;
  averageVolume: number | null;
  exchange: string | null;
  quoteType: string | null;
}

export interface PricePoint {
  /** Unix epoch milliseconds. */
  t: number;
  /** Closing price for that bar. */
  c: number;
}

export interface PriceHistory {
  symbol: string;
  range: Range;
  currency: string;
  points: PricePoint[];
}

export interface NewsItem {
  id: string;
  title: string;
  publisher: string;
  link: string;
  publishedAt: string;
}

export interface SearchResult {
  symbol: string;
  name: string;
  exchange: string;
  type: string;
}

export interface WatchlistEntry {
  quote: Quote;
  /** Intraday closes for the latest session, for the sparkline. */
  spark: PricePoint[];
}

/** JSON error body returned by every API route. */
export interface ApiErrorBody {
  error: { code: string; message: string };
}
