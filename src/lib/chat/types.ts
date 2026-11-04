import type { PortfolioSummary, Portfolio, Trade } from "@/lib/portfolio";
import type { PricePoint, Quote, Range } from "@/lib/types";

/**
 * Rich attachments the chat UI renders under a reply (mini charts, quote
 * cards…). Every number in a widget comes straight from a tool result.
 */
export type ChatWidget =
  | { kind: "quote"; quote: Quote }
  | {
      kind: "history";
      symbol: string;
      range: Range;
      currency: string;
      points: PricePoint[];
      start: number;
      end: number;
      change: number;
      changePercent: number;
      high: number;
      low: number;
    }
  | {
      kind: "compare";
      range: Range;
      rows: {
        symbol: string;
        name: string;
        price: number;
        currency: string;
        rangeChangePercent: number | null;
        marketCap: number | null;
        trailingPE: number | null;
      }[];
      /** Each symbol's % change from the start of the range, for one shared axis. */
      series: { symbol: string; points: PricePoint[] }[];
    }
  | { kind: "trade"; trade: Trade }
  | { kind: "portfolio"; summary: PortfolioSummary };

export interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

export interface ChatRequestBody {
  messages: ChatTurn[];
  portfolio: Portfolio;
}

export type ChatMode = "ai" | "basic";

export interface ChatResponseBody {
  mode: ChatMode;
  reply: string;
  widgets: ChatWidget[];
  /** Trades the server executed against the portfolio snapshot; the browser re-applies them. */
  trades: Trade[];
  /** Set when AI mode failed and the built-in parser answered instead. */
  notice?: string;
}
