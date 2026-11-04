import type { Range } from "@/lib/types";

/** Axis/tooltip date labels that suit each range. */
export function formatTick(t: number, range: Range): string {
  const d = new Date(t);
  if (range === "1D") return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  if (range === "1W") return d.toLocaleDateString("en-US", { weekday: "short" });
  if (range === "5Y") return d.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function formatTooltipDate(t: number, range: Range): string {
  const d = new Date(t);
  const intraday = range === "1D" || range === "1W" || range === "1M";
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: intraday ? undefined : "numeric",
    hour: intraday ? "numeric" : undefined,
    minute: intraday ? "2-digit" : undefined,
  });
}

/** ~`count` evenly spaced x-axis ticks, so labels never repeat or crowd. */
export function evenTicks(points: { t: number }[], count = 5): number[] {
  if (points.length <= count) return points.map((p) => p.t);
  const step = (points.length - 1) / (count - 1);
  return Array.from({ length: count }, (_, i) => points[Math.round(i * step)].t);
}
