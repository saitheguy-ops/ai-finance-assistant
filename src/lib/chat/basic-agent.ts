import {
  formatCompactMoney,
  formatMoney,
  formatNumber,
  formatPercent,
  formatShares,
  formatSignedMoney,
} from "@/lib/format";
import type { Range } from "@/lib/types";
import { HELP_TEXT, parseCommand } from "./parser";
import type { Toolbox } from "./tools";

/**
 * Basic (no API key) chat: parse the message, call the matching tool, and
 * phrase the result. The wording is templated, but every number in it comes
 * from the tool's real data.
 */

const RANGE_WORDS: Record<Range, string> = {
  "1D": "today",
  "1W": "over the past week",
  "1M": "over the past month",
  "1Y": "over the past year",
  "5Y": "over the past 5 years",
};

const verb = (pct: number) => (pct > 0 ? "up" : pct < 0 ? "down" : "flat");

type Data = Record<string, unknown>;
const n = (v: unknown) => (typeof v === "number" ? v : null);

export async function runBasicChat(message: string, toolbox: Toolbox): Promise<string> {
  const intent = parseCommand(message);

  switch (intent.type) {
    case "help":
      return HELP_TEXT;

    case "unknown":
      return intent.reason
        ? intent.reason
        : `I didn't catch that. I'm running in basic mode, so I understand specific commands.\n\n${HELP_TEXT}`;

    case "quote": {
      const r = await toolbox.run("get_quote", { symbol: intent.symbol });
      if (!r.ok) return r.error;
      const d = r.data as Data;
      const pct = n(d.change_today_percent) ?? 0;
      const cur = String(d.currency);
      const pe = n(d.trailing_pe);
      return [
        `**${d.symbol}** (${d.name}) is at **${formatMoney(n(d.price) ?? 0, cur)}**, ${verb(pct)} ${formatPercent(pct)} today.`,
        `Market cap ${formatCompactMoney(n(d.market_cap), cur)}${pe !== null ? ` · P/E ${formatNumber(pe)}` : ""}.`,
      ].join(" ");
    }

    case "history": {
      const r = await toolbox.run("get_history", { symbol: intent.symbol, range: intent.range });
      if (!r.ok) return r.error;
      const d = r.data as Data;
      const pct = n(d.change_percent) ?? 0;
      const cur = String(d.currency);
      return (
        `**${d.symbol}** is ${verb(pct)} **${formatPercent(pct)}** ${RANGE_WORDS[intent.range]}, ` +
        `from ${formatMoney(n(d.start_price) ?? 0, cur)} to ${formatMoney(n(d.end_price) ?? 0, cur)} ` +
        `(${formatSignedMoney(n(d.change) ?? 0, cur)}). Range: ${formatMoney(n(d.low) ?? 0, cur)} – ${formatMoney(n(d.high) ?? 0, cur)}.`
      );
    }

    case "compare": {
      const r = await toolbox.run("compare", { symbols: intent.symbols, range: intent.range });
      if (!r.ok) return r.error;
      const rows = (r.data as { comparison: Data[] }).comparison;
      const withChange = rows.filter((row) => n(row.change_percent_over_range) !== null);
      const lines = rows.map((row) => {
        const pct = n(row.change_percent_over_range);
        return `• **${row.symbol}** ${formatMoney(n(row.price) ?? 0, String(row.currency))}${
          pct !== null ? `, ${formatPercent(pct)} ${RANGE_WORDS[intent.range]}` : ""
        }`;
      });
      if (withChange.length >= 2) {
        const best = withChange.reduce((a, b) => ((n(a.change_percent_over_range) ?? 0) >= (n(b.change_percent_over_range) ?? 0) ? a : b));
        lines.push(`\n${best.symbol} performed best ${RANGE_WORDS[intent.range]}. (Past performance doesn't predict future returns.)`);
      }
      return lines.join("\n");
    }

    case "tradeDollars": {
      // Convert a dollar amount into whole shares at the live price.
      const q = await toolbox.run("get_quote", { symbol: intent.symbol });
      if (!q.ok) return q.error;
      const price = n((q.data as Data).price);
      if (!price) return `I couldn't get a price for ${intent.symbol}.`;
      const shares = Math.floor(intent.dollars / price);
      if (shares < 1) {
        return `${formatMoney(intent.dollars)} isn't enough for one share of ${intent.symbol} at ${formatMoney(price)}.`;
      }
      return tradeReply(await toolbox.run(intent.side, { symbol: intent.symbol, shares }), intent.side);
    }

    case "trade":
      return tradeReply(await toolbox.run(intent.side, { symbol: intent.symbol, shares: intent.shares }), intent.side);

    case "portfolio": {
      const r = await toolbox.run("get_portfolio", {});
      if (!r.ok) return r.error;
      const d = r.data as Data;
      const holdings = d.holdings as Data[];
      const pct = n(d.total_pnl_percent) ?? 0;
      const head = `Your paper portfolio is worth **${formatMoney(n(d.total_value) ?? 0)}** (${formatSignedMoney(
        n(d.total_pnl) ?? 0,
      )}, ${formatPercent(pct)} since the $100,000 start). Cash: ${formatMoney(n(d.cash) ?? 0)}.`;
      if (holdings.length === 0) return `${head}\nNo positions yet. Try “buy 10 AAPL”.`;
      const lines = holdings.map((h) => {
        const upct = n(h.unrealized_pnl_percent);
        return `• **${h.symbol}** ${formatShares(n(h.shares) ?? 0)} sh${upct !== null ? `, ${formatPercent(upct)}` : ""}`;
      });
      return [head, ...lines, d.note ? `_${d.note}_` : ""].filter(Boolean).join("\n");
    }
  }
}

function tradeReply(r: Awaited<ReturnType<Toolbox["run"]>>, side: "buy" | "sell"): string {
  if (!r.ok) return r.error;
  const d = r.data as Data;
  const realized = n(d.realized_pnl);
  return (
    `${side === "buy" ? "Bought" : "Sold"} **${formatShares(n(d.shares) ?? 0)} ${d.symbol}** at ${formatMoney(n(d.fill_price) ?? 0)} ` +
    `(total ${formatMoney(n(d.total) ?? 0)})${realized !== null ? `, realized ${formatSignedMoney(realized)}` : ""}. ` +
    `Cash left: ${formatMoney(n(d.cash_after) ?? 0)}. _Paper trade, fake money._`
  );
}
