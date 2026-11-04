import type { NextRequest } from "next/server";

import { yahooProvider } from "@/lib/market/yahoo";
import { errorResponse, handleRouteError } from "@/lib/server/http";

/** GET /api/search?q=apple — ticker lookup for the "add to watchlist" box. */
export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (q.length < 1 || q.length > 40) {
    return errorResponse("INVALID_QUERY", "Search text must be 1–40 characters.", 400);
  }
  try {
    const results = await yahooProvider.search(q);
    return Response.json({ results }, { headers: { "Cache-Control": "public, max-age=300" } });
  } catch (err) {
    return handleRouteError(err);
  }
}
