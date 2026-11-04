/**
 * A small, typed error for everything that can go wrong while fetching market
 * data. API routes turn it into an HTTP status + friendly message, and the chat
 * turns it into a sentence instead of a stack trace.
 */
export type MarketErrorCode = "INVALID_SYMBOL" | "NOT_FOUND" | "UNAVAILABLE";

const STATUS: Record<MarketErrorCode, number> = {
  INVALID_SYMBOL: 400,
  NOT_FOUND: 404,
  UNAVAILABLE: 503,
};

export class MarketDataError extends Error {
  readonly code: MarketErrorCode;

  constructor(code: MarketErrorCode, message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "MarketDataError";
    this.code = code;
  }

  get status(): number {
    return STATUS[this.code];
  }
}

export function isMarketDataError(err: unknown): err is MarketDataError {
  return err instanceof MarketDataError;
}
