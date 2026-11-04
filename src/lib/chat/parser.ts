import { normalizeSymbol } from "@/lib/market/symbols";
import type { Range } from "@/lib/types";

/**
 * The no-API-key "brain": a small rule-based parser that turns a message into
 * an intent. It's deliberately simple (regexes + a stopword list) so it's easy
 * to read and test. Anything it can't understand becomes `unknown`, and the
 * reply suggests commands that do work.
 */

export type Intent =
  | { type: "help" }
  | { type: "portfolio" }
  | { type: "quote"; symbol: string }
  | { type: "history"; symbol: string; range: Range }
  | { type: "compare"; symbols: string[]; range: Range }
  | { type: "trade"; side: "buy" | "sell"; symbol: string; shares: number }
  | { type: "tradeDollars"; side: "buy" | "sell"; symbol: string; dollars: number }
  | { type: "unknown"; reason?: string };

/** Company names people commonly type instead of tickers. */
const ALIASES: Record<string, string> = {
  apple: "AAPL",
  microsoft: "MSFT",
  nvidia: "NVDA",
  tesla: "TSLA",
  google: "GOOGL",
  alphabet: "GOOGL",
  amazon: "AMZN",
  meta: "META",
  facebook: "META",
  netflix: "NFLX",
  amd: "AMD",
  intel: "INTC",
  disney: "DIS",
  walmart: "WMT",
  coca: "KO",
  "coca-cola": "KO",
  nike: "NKE",
  spotify: "SPOT",
  uber: "UBER",
  airbnb: "ABNB",
  palantir: "PLTR",
  berkshire: "BRK-B",
  bitcoin: "BTC-USD",
  ethereum: "ETH-USD",
  "s&p": "^GSPC",
  sp500: "^GSPC",
  nasdaq: "^IXIC",
  dow: "^DJI",
};

/** Lowercase words that are never tickers in a chat message. */
const STOPWORDS = new Set(
  `a an the i me my we us you your it its is are was were be been am do does did done doing
   how what whats what's which who when where why show tell give get check see look find please can could would
   buy sell purchase shares share stock stocks of in on at to for from by with and or vs versus compare
   price prices quote quotes worth cost costs trading trade trades much many current currently now right
   today day daily week weekly month monthly year yearly years ytd past last this over since
   performance perform performed doing chart history move moved change changed up down
   portfolio holdings positions balance cash account summary help hi hello hey thanks thank ok okay
   about info information on going go has have had going lately recently five 5y 1y 1m 1w 1d all time
   dollars dollar usd worth value`.split(/\s+/),
);

/** Capitalised words that show up in finance chat but aren't tickers. */
const CAPS_NOT_TICKERS = new Set(["I", "A", "OK", "US", "USA", "AM", "PM", "ETF", "CEO", "IPO", "PE", "EPS", "USD", "YTD", "AI", "TTM", "P", "E"]);

const FINANCE_HINT =
  /\b(price|quote|buy|sell|purchase|shares?|stock|compare|vs|versus|chart|trading|worth|how (did|is|has|was)|perform\w*|week|month|year|today|ytd)\b|\$/i;

/** Detects which time range a message is asking about. Defaults to 1M. */
export function detectRange(text: string): Range {
  const t = text.toLowerCase();
  if (/\b(5\s*y(ea)?rs?|five years|5y)\b/.test(t)) return "5Y";
  if (/\b(today|1d|intraday|this session)\b/.test(t)) return "1D";
  if (/\b(week|1w|7 days|five days|5 days)\b/.test(t)) return "1W";
  if (/\b(year|1y|12 months|ytd|annual)\b/.test(t)) return "1Y";
  return "1M";
}

/**
 * Finds tickers in free text, in order of appearance. Priority:
 * $TSLA cash-tags, company names (apple → AAPL), words typed in CAPITALS,
 * and finally any short word that isn't a common English word.
 */
export function extractSymbols(text: string, assumeFinancial = false): string[] {
  const found: { index: number; symbol: string }[] = [];
  const seen = new Set<string>();
  const add = (index: number, raw: string) => {
    const s = normalizeSymbol(raw);
    if (s && !seen.has(s)) {
      seen.add(s);
      found.push({ index, symbol: s });
    }
  };

  for (const m of text.matchAll(/\$([A-Za-z][A-Za-z0-9.\-]{0,9})/g)) add(m.index, m[1]);

  for (const m of text.matchAll(/[A-Za-z&][A-Za-z0-9&\-]*/g)) {
    const alias = ALIASES[m[0].toLowerCase()];
    if (alias) add(m.index, alias);
  }

  // Words typed in CAPITALS are almost always tickers in a mixed-case message
  // ("how did NOW do" means ServiceNow). In an ALL-CAPS message we can't tell,
  // so fall back to skipping common English words.
  const tokens = [...text.matchAll(/\^?[A-Za-z][A-Za-z0-9.\-=]*/g)];
  const allCaps = text === text.toUpperCase();
  let capsFound = false;
  for (const m of tokens) {
    const w = m[0].replace(/[.\-]+$/, "");
    const isCaps = w.length >= 1 && w.length <= 6 && w === w.toUpperCase() && /[A-Z]/.test(w);
    if (!isCaps || ALIASES[w.toLowerCase()] || CAPS_NOT_TICKERS.has(w)) continue;
    if (allCaps && STOPWORDS.has(w.toLowerCase())) continue;
    add(m.index, w);
    capsFound = true;
  }

  // Lowercase fallback ("nvda", "price of tsla"): only when the message is a
  // single word or clearly about markets, so "hello there" isn't a ticker.
  const looksFinancial = assumeFinancial || tokens.length === 1 || FINANCE_HINT.test(text);
  if (!capsFound && found.length === 0 && looksFinancial) {
    for (const m of tokens) {
      const w = m[0].replace(/[.\-]+$/, "");
      if (w.length <= 5 && /^[a-z^][a-z.\-]*$/i.test(w) && !STOPWORDS.has(w.toLowerCase())) add(m.index, w);
    }
  }

  return found.sort((a, b) => a.index - b.index).map((f) => f.symbol);
}

export function parseCommand(input: string): Intent {
  const text = input.trim();
  const lower = text.toLowerCase();
  if (!text) return { type: "unknown" };

  if (/^(help|\?|commands|what can you do|what can i (say|ask)|how does this work)\b/.test(lower)) return { type: "help" };

  // Trades: "buy 10 TSLA", "sell 5 shares of AAPL", "buy $500 of NVDA", "buy 1000 dollars of apple"
  const trade = lower.match(/\b(buy|purchase|sell)\b/);
  if (trade) {
    const side = trade[1] === "sell" ? "sell" : "buy";
    const after = text.slice((trade.index ?? 0) + trade[0].length);
    const symbols = extractSymbols(after.replace(/\$\s*[\d,]+(\.\d+)?/g, " "), true);
    const symbol = symbols[0];
    const dollars = after.match(/\$\s*([\d,]+(?:\.\d+)?)|([\d,]+(?:\.\d+)?)\s*(?:dollars|usd|bucks)\b/i);
    if (dollars) {
      const amount = Number((dollars[1] ?? dollars[2]).replace(/,/g, ""));
      if (!symbol) return { type: "unknown", reason: "Which ticker? Try “buy $500 of AAPL”." };
      return { type: "tradeDollars", side, symbol, dollars: amount };
    }
    const qty = after.match(/(\d[\d,]*(?:\.\d+)?)/);
    if (!symbol) return { type: "unknown", reason: `Which ticker should I ${side}? Try “${side} 10 AAPL”.` };
    if (!qty) return { type: "unknown", reason: `How many shares? Try “${side} 10 ${symbol}”.` };
    const shares = Number(qty[1].replace(/,/g, ""));
    if (!Number.isInteger(shares)) return { type: "unknown", reason: "Paper trades use whole shares only." };
    return { type: "trade", side, symbol, shares };
  }

  if (/\b(compare|vs\.?|versus|against)\b/.test(lower)) {
    const symbols = extractSymbols(text);
    if (symbols.length >= 2) return { type: "compare", symbols: symbols.slice(0, 4), range: detectRange(text) };
    return { type: "unknown", reason: "Give me at least two tickers, e.g. “compare AAPL MSFT”." };
  }

  if (/\b(portfolio|holdings|positions|my (cash|balance|account|stocks)|how am i doing|net worth|p&l|pnl)\b/.test(lower)) {
    return { type: "portfolio" };
  }

  const symbols = extractSymbols(text);
  if (symbols.length >= 2 && /\b(and|,)\b|,/.test(lower) && /\b(how|perform|did|do)\b/.test(lower)) {
    return { type: "compare", symbols: symbols.slice(0, 4), range: detectRange(text) };
  }
  const symbol = symbols[0];
  if (!symbol) return { type: "unknown" };

  if (/\b(how (did|has|is|was)|perform|performance|chart|history|trend|moved?|change|doing|did .* do|go(ne)? (up|down))\b/.test(lower)) {
    return { type: "history", symbol, range: detectRange(text) };
  }
  if (/\b(week|month|year|ytd|5\s*y)/.test(lower)) return { type: "history", symbol, range: detectRange(text) };

  return { type: "quote", symbol };
}

export const HELP_TEXT = [
  "Here's what I can do with real market data:",
  "• **Prices** — “price of NVDA”, “AAPL”",
  "• **Performance** — “how did MSFT do this month?”, “TSLA over 5 years”",
  "• **Compare** — “compare AAPL MSFT GOOGL”",
  "• **Paper trades** — “buy 10 TSLA”, “sell 5 AAPL”, “buy $500 of NVDA”",
  "• **Portfolio** — “show my portfolio”",
  "Trades use fake money only. Nothing here is financial advice.",
].join("\n");
