import type { PricePoint, Range } from "@/lib/types";

const DAY = 24 * 60 * 60 * 1000;

export interface RangeConfig {
  /** How far back to request data. */
  lookbackMs: number;
  interval: "5m" | "30m" | "60m" | "1d" | "1wk";
  /** How long a fetched result stays fresh in our cache. */
  ttlMs: number;
}

/**
 * Maps a UI range to a Yahoo chart request. 1D asks for 5 days of 5-minute
 * bars and then keeps only the most recent session, so weekends and holidays
 * still show the last trading day instead of an empty chart.
 */
export const RANGE_CONFIG: Record<Range, RangeConfig> = {
  "1D": { lookbackMs: 5 * DAY, interval: "5m", ttlMs: 60_000 },
  "1W": { lookbackMs: 7 * DAY, interval: "30m", ttlMs: 5 * 60_000 },
  "1M": { lookbackMs: 31 * DAY, interval: "60m", ttlMs: 15 * 60_000 },
  "1Y": { lookbackMs: 366 * DAY, interval: "1d", ttlMs: 60 * 60_000 },
  "5Y": { lookbackMs: 5 * 366 * DAY, interval: "1wk", ttlMs: 6 * 60 * 60_000 },
};

export function isRange(value: unknown): value is Range {
  return typeof value === "string" && value in RANGE_CONFIG;
}

/**
 * Keeps only the points from the last trading session. `gmtOffsetSec` is the
 * exchange's UTC offset so "session" means the exchange's calendar day, not
 * the server's.
 */
export function lastSession(points: PricePoint[], gmtOffsetSec: number): PricePoint[] {
  if (points.length === 0) return points;
  const dayOf = (t: number) => Math.floor((t + gmtOffsetSec * 1000) / DAY);
  const lastDay = dayOf(points[points.length - 1].t);
  return points.filter((p) => dayOf(p.t) === lastDay);
}

/** Picks the smallest range that covers everything since `sinceMs`. */
export function rangeCovering(sinceMs: number, now = Date.now()): Range {
  const age = now - sinceMs;
  if (age <= 1 * DAY) return "1D";
  if (age <= 7 * DAY) return "1W";
  if (age <= 31 * DAY) return "1M";
  if (age <= 366 * DAY) return "1Y";
  return "5Y";
}
