/** Number formatting helpers shared by the UI and the chat replies. */

export function formatMoney(value: number, currency = "USD"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: Math.abs(value) < 1 && value !== 0 ? 4 : 2,
  }).format(value);
}

export function formatSignedMoney(value: number, currency = "USD"): string {
  const s = formatMoney(Math.abs(value), currency);
  return value > 0 ? `+${s}` : value < 0 ? `−${s}` : s;
}

export function formatPercent(value: number, digits = 2): string {
  const s = `${Math.abs(value).toFixed(digits)}%`;
  return value > 0 ? `+${s}` : value < 0 ? `−${s}` : s;
}

/** 2_870_000_000_000 → "$2.87T" */
export function formatCompactMoney(value: number | null, currency = "USD"): string {
  if (value === null) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    notation: "compact",
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatCompactNumber(value: number | null): string {
  if (value === null) return "—";
  return new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 2 }).format(value);
}

export function formatNumber(value: number | null, digits = 2): string {
  if (value === null) return "—";
  return value.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

export function formatShares(value: number): string {
  return value.toLocaleString("en-US", { maximumFractionDigits: 4 });
}

/** Up / down / flat, for picking colours and arrows. */
export function direction(value: number): "up" | "down" | "flat" {
  return value > 0 ? "up" : value < 0 ? "down" : "flat";
}
