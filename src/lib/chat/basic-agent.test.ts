import { describe, expect, it } from "vitest";

import { createPortfolio } from "@/lib/portfolio";
import { createFakeMarket } from "@/test/fake-market";
import { runBasicChat } from "./basic-agent";
import { createToolbox } from "./tools";

const market = createFakeMarket({ AAPL: 200, MSFT: 400, NVDA: 100, TSLA: 250 });
const chat = (msg: string) => {
  const tb = createToolbox(market, createPortfolio());
  return runBasicChat(msg, tb).then((reply) => ({ reply, tb }));
};

describe("runBasicChat", () => {
  it("answers price questions with provider numbers", async () => {
    const { reply, tb } = await chat("price of NVDA");
    expect(reply).toContain("$100.00");
    expect(tb.widgets[0].kind).toBe("quote");
  });

  it("answers performance questions", async () => {
    const { reply } = await chat("how did MSFT do this month?");
    expect(reply).toMatch(/MSFT\*\* is up \*\*\+10\.00%\*\* over the past month/);
  });

  it("buys and reports the fill", async () => {
    const { reply, tb } = await chat("buy 10 shares of TSLA");
    expect(reply).toContain("Bought **10 TSLA** at $250.00");
    expect(tb.trades).toHaveLength(1);
  });

  it("converts dollar amounts to whole shares", async () => {
    const { reply, tb } = await chat("buy $450 of AAPL");
    expect(reply).toContain("Bought **2 AAPL**");
    expect(tb.trades[0].shares).toBe(2);
  });

  it("compares tickers", async () => {
    const { reply, tb } = await chat("compare AAPL MSFT");
    expect(reply).toContain("**AAPL** $200.00");
    expect(tb.widgets[0].kind).toBe("compare");
  });

  it("handles bad tickers and outages gracefully", async () => {
    expect((await chat("price of ZZZZ")).reply).toBe("Couldn't find a ticker called ZZZZ.");
    const down = createToolbox(createFakeMarket({}, { down: true }), createPortfolio());
    expect(await runBasicChat("price of AAPL", down)).toMatch(/isn't responding/);
  });

  it("shows help for unknown input", async () => {
    expect((await chat("tell me a joke")).reply).toMatch(/basic mode/);
  });
});
