import { describe, expect, it, vi } from "vitest";

import { TtlCache } from "./cache";

describe("TtlCache", () => {
  it("coalesces concurrent loads and reuses fresh values", async () => {
    const cache = new TtlCache();
    const load = vi.fn(async () => 42);
    const [a, b] = await Promise.all([cache.get("k", 1000, load), cache.get("k", 1000, load)]);
    expect(a).toBe(42);
    expect(b).toBe(42);
    await cache.get("k", 1000, load);
    expect(load).toHaveBeenCalledTimes(1);
  });

  it("does not cache failures", async () => {
    const cache = new TtlCache();
    const load = vi.fn().mockRejectedValueOnce(new Error("down")).mockResolvedValueOnce("ok");
    await expect(cache.get("k", 1000, load)).rejects.toThrow("down");
    await expect(cache.get("k", 1000, load)).resolves.toBe("ok");
  });
});
