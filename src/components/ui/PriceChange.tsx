import { direction, formatPercent, formatSignedMoney } from "@/lib/format";

/**
 * Gain/loss display. Colour is never the only signal: there's always a sign
 * and an arrow too, so it reads fine for colour-blind users.
 */
export function PriceChange({
  change,
  percent,
  currency = "USD",
  size = "sm",
  pill = false,
}: {
  change?: number;
  percent: number;
  currency?: string;
  size?: "sm" | "lg";
  pill?: boolean;
}) {
  const dir = direction(percent);
  const color = dir === "up" ? "text-up" : dir === "down" ? "text-down" : "text-muted";
  const bg = pill ? (dir === "up" ? "bg-up-soft" : dir === "down" ? "bg-down-soft" : "bg-surface-2") : "";
  const arrow = dir === "up" ? "▲" : dir === "down" ? "▼" : "•";
  return (
    <span
      className={`tabular inline-flex items-center gap-1 whitespace-nowrap font-medium ${color} ${bg} ${
        pill ? "rounded-md px-1.5 py-0.5" : ""
      } ${size === "lg" ? "text-base" : "text-sm"}`}
    >
      <span aria-hidden className="text-[0.7em]">
        {arrow}
      </span>
      {change !== undefined && <span>{formatSignedMoney(change, currency)}</span>}
      <span>{change !== undefined ? `(${formatPercent(percent)})` : formatPercent(percent)}</span>
    </span>
  );
}
