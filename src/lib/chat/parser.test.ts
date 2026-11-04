import { describe, expect, it } from "vitest";

import { detectRange, extractSymbols, parseCommand } from "./parser";

describe("parseCommand", () => {
  it.each([
    ["help", { type: "help" }],
    ["what can you do?", { type: "help" }],
    ["show my portfolio", { type: "portfolio" }],
    ["how am I doing", { type: "portfolio" }],
    ["price of NVDA", { type: "quote", symbol: "NVDA" }],
    ["nvda", { type: "quote", symbol: "NVDA" }],
    ["what's apple trading at", { type: "quote", symbol: "AAPL" }],
    ["$tsla", { type: "quote", symbol: "TSLA" }],
    ["how did MSFT do this month", { type: "history", symbol: "MSFT", range: "1M" }],
    ["how did nvda do this month?", { type: "history", symbol: "NVDA", range: "1M" }],
    ["TSLA over 5 years", { type: "history", symbol: "TSLA", range: "5Y" }],
    ["how is AMZN doing today", { type: "history", symbol: "AMZN", range: "1D" }],
    ["chart GOOGL this year", { type: "history", symbol: "GOOGL", range: "1Y" }],
    ["how did NOW do this week", { type: "history", symbol: "NOW", range: "1W" }],
    ["compare AAPL MSFT", { type: "compare", symbols: ["AAPL", "MSFT"], range: "1M" }],
    ["compare AAPL and MSFT over the past year", { type: "compare", symbols: ["AAPL", "MSFT"], range: "1Y" }],
    ["NVDA vs AMD", { type: "compare", symbols: ["NVDA", "AMD"], range: "1M" }],
    ["compare apple, microsoft and google", { type: "compare", symbols: ["AAPL", "MSFT", "GOOGL"], range: "1M" }],
    ["buy 10 TSLA", { type: "trade", side: "buy", symbol: "TSLA", shares: 10 }],
    ["buy 10 shares of TSLA", { type: "trade", side: "buy", symbol: "TSLA", shares: 10 }],
    ["sell 5 aapl", { type: "trade", side: "sell", symbol: "AAPL", shares: 5 }],
    ["please buy 1,000 shares of apple", { type: "trade", side: "buy", symbol: "AAPL", shares: 1000 }],
    ["BUY 3 NVDA", { type: "trade", side: "buy", symbol: "NVDA", shares: 3 }],
    ["buy $500 of NVDA", { type: "tradeDollars", side: "buy", symbol: "NVDA", dollars: 500 }],
    ["buy 250 dollars of msft", { type: "tradeDollars", side: "buy", symbol: "MSFT", dollars: 250 }],
  ])("%s", (input, expected) => {
    expect(parseCommand(input)).toEqual(expected);
  });

  it("asks for missing details instead of guessing", () => {
    expect(parseCommand("buy TSLA")).toMatchObject({ type: "unknown", reason: expect.stringMatching(/How many shares/) });
    expect(parseCommand("buy 10")).toMatchObject({ type: "unknown", reason: expect.stringMatching(/Which ticker/) });
    expect(parseCommand("buy 1.5 TSLA")).toMatchObject({ type: "unknown", reason: expect.stringMatching(/whole shares/) });
    expect(parseCommand("compare AAPL")).toMatchObject({ type: "unknown" });
  });

  it("returns unknown for chit-chat", () => {
    expect(parseCommand("hello there")).toEqual({ type: "unknown" });
    expect(parseCommand("")).toEqual({ type: "unknown" });
  });
});

describe("extractSymbols", () => {
  it("ignores capitalised non-tickers", () => {
    expect(extractSymbols("OK, I want the AAPL price")).toEqual(["AAPL"]);
  });
  it("keeps order of appearance", () => {
    expect(extractSymbols("MSFT then apple")).toEqual(["MSFT", "AAPL"]);
  });
});

describe("detectRange", () => {
  it("defaults to a month", () => {
    expect(detectRange("how did it go")).toBe("1M");
  });
});
