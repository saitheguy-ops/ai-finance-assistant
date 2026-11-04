import { MarketDataError } from "./errors";

/**
 * Tickers are letters/digits plus a few separators Yahoo uses:
 * BRK-B, BTC-USD, ^GSPC (indexes), 7203.T (Tokyo), EURUSD=X (FX).
 */
const SYMBOL_RE = /^\^?[A-Z0-9][A-Z0-9.\-=]{0,14}$/;

/** Uppercases and trims a ticker, returning null if it can't be a real symbol. */
export function normalizeSymbol(input: string): string | null {
  const s = input.trim().toUpperCase().replace(/^\$/, "");
  return SYMBOL_RE.test(s) ? s : null;
}

/** Like normalizeSymbol but throws a MarketDataError for bad input. */
export function requireSymbol(input: unknown): string {
  const s = typeof input === "string" ? normalizeSymbol(input) : null;
  if (!s) {
    throw new MarketDataError("INVALID_SYMBOL", `"${String(input)}" doesn't look like a ticker symbol.`);
  }
  return s;
}

/** Parses "AAPL, msft nvda" into ["AAPL","MSFT","NVDA"], de-duplicated, capped. */
export function parseSymbolList(input: string | null, max = 25): string[] {
  if (!input) return [];
  const out: string[] = [];
  for (const part of input.split(/[\s,]+/)) {
    const s = normalizeSymbol(part);
    if (s && !out.includes(s)) out.push(s);
    if (out.length >= max) break;
  }
  return out;
}
