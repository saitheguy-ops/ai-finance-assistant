import "server-only";

import { isMarketDataError } from "@/lib/market/errors";
import type { ApiErrorBody } from "@/lib/types";

/** Consistent JSON error responses for every API route. */
export function errorResponse(code: string, message: string, status: number): Response {
  const body: ApiErrorBody = { error: { code, message } };
  return Response.json(body, { status });
}

/** Converts anything thrown inside a route into a safe JSON error. */
export function handleRouteError(err: unknown): Response {
  if (isMarketDataError(err)) return errorResponse(err.code, err.message, err.status);
  console.error("Unexpected API error:", err);
  return errorResponse("INTERNAL", "Something went wrong on our side.", 500);
}

/** Short browser/CDN cache so rapid re-renders don't refetch. */
export const SHORT_CACHE = { "Cache-Control": "public, max-age=10, s-maxage=15, stale-while-revalidate=30" };
