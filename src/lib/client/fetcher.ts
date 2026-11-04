import type { ApiErrorBody } from "@/lib/types";

/** Error thrown by `fetchJson` with the API's error code attached. */
export class ApiError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/**
 * fetch() + JSON + our error format. Used directly and as the SWR fetcher.
 * Network failures become an ApiError too, so the UI has one thing to handle.
 */
export async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, init);
  } catch {
    throw new ApiError("NETWORK", "Can't reach the server. Check your connection.", 0);
  }
  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    const err = (body as ApiErrorBody | null)?.error;
    throw new ApiError(err?.code ?? "HTTP_ERROR", err?.message ?? `Request failed (${res.status}).`, res.status);
  }
  return body as T;
}

export function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : "Something went wrong.";
}
