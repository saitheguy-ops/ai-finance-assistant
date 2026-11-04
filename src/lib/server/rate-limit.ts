import "server-only";

/**
 * Best-effort fixed-window rate limiter kept in memory. On serverless hosts
 * each instance has its own counters, so this is a speed bump (protects your
 * Anthropic bill from a runaway script), not a hard guarantee.
 */
const windows = new Map<string, { start: number; count: number }>();

export function rateLimit(key: string, limit: number, windowMs: number, now = Date.now()) {
  const w = windows.get(key);
  if (!w || now - w.start >= windowMs) {
    windows.set(key, { start: now, count: 1 });
    if (windows.size > 5000) windows.clear(); // crude memory cap
    return { ok: true, retryAfterSec: 0 };
  }
  w.count++;
  if (w.count > limit) return { ok: false, retryAfterSec: Math.ceil((w.start + windowMs - now) / 1000) };
  return { ok: true, retryAfterSec: 0 };
}

export function clientIp(request: Request): string {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "local";
}
