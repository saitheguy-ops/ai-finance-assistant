import { requireSymbol } from "@/lib/market/symbols";
import { yahooProvider } from "@/lib/market/yahoo";
import { SHORT_CACHE, handleRouteError } from "@/lib/server/http";

/**
 * GET /api/stock/AAPL — quote + key stats + recent news for the detail page.
 * News is best-effort: if it fails we still return the quote.
 */
export async function GET(_request: Request, ctx: RouteContext<"/api/stock/[symbol]">) {
  try {
    const symbol = requireSymbol(decodeURIComponent((await ctx.params).symbol));
    const [quote, news] = await Promise.all([
      yahooProvider.getQuote(symbol),
      yahooProvider.getNews(symbol).catch(() => null),
    ]);
    return Response.json({ quote, news }, { headers: SHORT_CACHE });
  } catch (err) {
    return handleRouteError(err);
  }
}
