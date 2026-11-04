import { describe, expect, it } from "vitest";

import { isRange, lastSession, rangeCovering } from "./ranges";

const HOUR = 3600_000;
const DAY = 24 * HOUR;

describe("lastSession", () => {
  it("keeps only the most recent exchange-local day", () => {
    // New York is UTC-5 (gmtoffset -18000). 14:30Z and 20:55Z are the same NY day;
    // the previous day's bars should be dropped.
    const day1 = Date.UTC(2026, 9, 1, 14, 30);
    const day2 = Date.UTC(2026, 9, 2, 14, 30);
    const points = [
      { t: day1, c: 1 },
      { t: day1 + 6 * HOUR, c: 2 },
      { t: day2, c: 3 },
      { t: day2 + 6 * HOUR + 25 * 60_000, c: 4 },
    ];
    expect(lastSession(points, -18000).map((p) => p.c)).toEqual([3, 4]);
  });
  it("handles empty input", () => {
    expect(lastSession([], 0)).toEqual([]);
  });
});

describe("rangeCovering", () => {
  const now = Date.UTC(2026, 10, 4);
  it("picks the smallest range that covers the span", () => {
    expect(rangeCovering(now - HOUR, now)).toBe("1D");
    expect(rangeCovering(now - 3 * DAY, now)).toBe("1W");
    expect(rangeCovering(now - 20 * DAY, now)).toBe("1M");
    expect(rangeCovering(now - 200 * DAY, now)).toBe("1Y");
    expect(rangeCovering(now - 900 * DAY, now)).toBe("5Y");
  });
});

describe("isRange", () => {
  it("validates", () => {
    expect(isRange("1M")).toBe(true);
    expect(isRange("2M")).toBe(false);
    expect(isRange(undefined)).toBe(false);
  });
});
