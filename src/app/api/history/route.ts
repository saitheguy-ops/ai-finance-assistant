import type { NextRequest } from "next/server";

import { isRange } from "@/lib/market/ranges";
import { requireSymbol } from "@/lib/market/symbols";
import { yahooProvider } from "@/lib/market/yahoo";
import { SHORT_CACHE, errorResponse, handleRouteError } from "@/lib/server/http";

/** GET /api/history?symbol=AAPL&range=1M */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const range = params.get("range") ?? "1M";
  if (!isRange(range)) {
    return errorResponse("INVALID_RANGE", "range must be one of 1D, 1W, 1M, 1Y, 5Y", 400);
  }
  try {
    const symbol = requireSymbol(params.get("symbol"));
    const history = await yahooProvider.getHistory(symbol, range);
    return Response.json(history, { headers: SHORT_CACHE });
  } catch (err) {
    return handleRouteError(err);
  }
}
