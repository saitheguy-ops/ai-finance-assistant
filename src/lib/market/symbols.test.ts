import { describe, expect, it } from "vitest";

import { normalizeSymbol, parseSymbolList, requireSymbol } from "./symbols";

describe("normalizeSymbol", () => {
  it("uppercases and trims", () => {
    expect(normalizeSymbol("  aapl ")).toBe("AAPL");
    expect(normalizeSymbol("$tsla")).toBe("TSLA");
  });
  it("accepts Yahoo-style symbols", () => {
    for (const s of ["BRK-B", "BTC-USD", "^GSPC", "7203.T", "EURUSD=X"]) {
      expect(normalizeSymbol(s)).toBe(s);
    }
  });
  it("rejects junk", () => {
    for (const s of ["", "hello world", "<script>", "A".repeat(20), "-AAPL"]) {
      expect(normalizeSymbol(s)).toBeNull();
    }
  });
});

describe("requireSymbol", () => {
  it("throws a typed error for bad input", () => {
    expect(() => requireSymbol("not a ticker")).toThrowError(/doesn't look like a ticker/);
    expect(() => requireSymbol(42)).toThrow();
  });
});

describe("parseSymbolList", () => {
  it("splits on commas/spaces, dedupes and caps", () => {
    expect(parseSymbolList("aapl, msft  nvda,aapl")).toEqual(["AAPL", "MSFT", "NVDA"]);
    expect(parseSymbolList("a b c d", 2)).toEqual(["A", "B"]);
    expect(parseSymbolList(null)).toEqual([]);
  });
});
