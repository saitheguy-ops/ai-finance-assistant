import { describe, expect, it } from "vitest";

import { createPortfolio } from "@/lib/portfolio";
import { createFakeMarket } from "@/test/fake-market";
import { TOOL_DEFINITIONS, TOOL_NAMES, createToolbox } from "./tools";

const market = createFakeMarket({ AAPL: 200, MSFT: 400, NVDA: 100 });

describe("toolbox", () => {
  it("defines a JSON schema for every tool", () => {
    expect(TOOL_DEFINITIONS.map((t) => t.name).sort()).toEqual([...TOOL_NAMES].sort());
    for (const t of TOOL_DEFINITIONS) {
      expect(t.input_schema.additionalProperties).toBe(false);
      expect(t.input_schema.required).toEqual(Object.keys(t.input_schema.properties));
    }
  });

  it("get_quote returns real provider data and a quote widget", async () => {
    const tb = createToolbox(market, createPortfolio());
    const r = await tb.run("get_quote", { symbol: "aapl" });
    expect(r).toMatchObject({ ok: true, data: { symbol: "AAPL", price: 200 } });
    expect(tb.widgets[0]).toMatchObject({ kind: "quote" });
  });

  it("get_history summarizes the range", async () => {
    const tb = createToolbox(market, createPortfolio());
    const r = await tb.run("get_history", { symbol: "NVDA", range: "1M" });
    expect(r.ok && r.data.change_percent).toBe(10);
    expect(r.ok && r.data.high).toBe(105);
  });

  it("buy then get_portfolio sees the new position in the same turn", async () => {
    const tb = createToolbox(market, createPortfolio());
    const buy = await tb.run("buy", { symbol: "MSFT", shares: 10 });
    expect(buy).toMatchObject({ ok: true, data: { fill_price: 400, total: 4000, cash_after: 96_000 } });
    const p = await tb.run("get_portfolio", {});
    expect(p.ok && p.data.holdings).toEqual([expect.objectContaining({ symbol: "MSFT", shares: 10 })]);
    expect(tb.trades).toHaveLength(1);
    expect(tb.trades[0].source).toBe("chat");
  });

  it("returns friendly errors instead of throwing", async () => {
    const tb = createToolbox(market, createPortfolio());
    expect(await tb.run("get_quote", { symbol: "ZZZZ" })).toEqual({ ok: false, error: "Couldn't find a ticker called ZZZZ." });
    expect(await tb.run("sell", { symbol: "AAPL", shares: 1 })).toMatchObject({ ok: false, error: /don't own any AAPL/ });
    expect(await tb.run("buy", { symbol: "AAPL", shares: 1.5 })).toMatchObject({ ok: false, error: /whole number/ });
    expect(await tb.run("compare", { symbols: ["AAPL"], range: "1M" })).toMatchObject({ ok: false });
    expect(await tb.run("delete_everything", {})).toMatchObject({ ok: false, error: /Unknown tool/ });
    expect(tb.trades).toHaveLength(0);
  });

  it("reports when the data source is down", async () => {
    const tb = createToolbox(createFakeMarket({}, { down: true }), createPortfolio());
    expect(await tb.run("get_quote", { symbol: "AAPL" })).toMatchObject({ ok: false, error: /isn't responding/ });
  });

  it("compare normalizes each series to % change", async () => {
    const tb = createToolbox(market, createPortfolio());
    const r = await tb.run("compare", { symbols: ["AAPL", "MSFT"], range: "1Y" });
    expect(r.ok).toBe(true);
    const w = tb.widgets[0];
    expect(w.kind === "compare" && w.series[0].points[0].c).toBe(0);
  });
});
