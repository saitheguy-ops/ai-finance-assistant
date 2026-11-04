import type { NextRequest } from "next/server";

import { parseSymbolList } from "@/lib/market/symbols";
import { yahooProvider } from "@/lib/market/yahoo";
import { SHORT_CACHE, errorResponse, handleRouteError } from "@/lib/server/http";
import type { PricePoint, WatchlistEntry } from "@/lib/types";

/**
 * GET /api/quotes?symbols=AAPL,MSFT[&spark=1]
 * Returns quotes (and optionally 1D sparkline points) for up to 25 symbols.
 * Symbols Yahoo doesn't recognise are listed in `missing` instead of failing
 * the whole request.
 */
export async function GET(request: NextRequest) {
  const symbols = parseSymbolList(request.nextUrl.searchParams.get("symbols"));
  if (symbols.length === 0) {
    return errorResponse("INVALID_SYMBOL", "Pass one or more symbols, e.g. ?symbols=AAPL,MSFT", 400);
  }
  const withSpark = request.nextUrl.searchParams.get("spark") === "1";

  try {
    const quotes = await yahooProvider.getQuotes(symbols);
    const found = new Set(quotes.map((q) => q.symbol));
    const missing = symbols.filter((s) => !found.has(s));

    const entries: WatchlistEntry[] = await Promise.all(
      quotes.map(async (quote) => {
        let spark: PricePoint[] = [];
        if (withSpark) {
          // A missing sparkline shouldn't hide the price.
          spark = await yahooProvider
            .getHistory(quote.symbol, "1D")
            .then((h) => h.points)
            .catch(() => []);
        }
        return { quote, spark };
      }),
    );

    return Response.json({ entries, missing }, { headers: SHORT_CACHE });
  } catch (err) {
    return handleRouteError(err);
  }
}
