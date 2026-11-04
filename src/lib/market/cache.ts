/**
 * Tiny in-memory TTL cache with request coalescing.
 *
 * Yahoo is an unofficial API, so we avoid hammering it: identical requests
 * within `ttlMs` share one result, and concurrent requests for the same key
 * share one in-flight promise. On Vercel each serverless instance has its own
 * cache; that's fine, it's only an optimisation.
 */
interface Entry<T> {
  expires: number;
  value: Promise<T>;
}

export class TtlCache {
  private store = new Map<string, Entry<unknown>>();

  constructor(private readonly maxEntries = 500) {}

  async get<T>(key: string, ttlMs: number, load: () => Promise<T>): Promise<T> {
    const now = Date.now();
    const hit = this.store.get(key) as Entry<T> | undefined;
    if (hit && hit.expires > now) return hit.value;

    const value = load();
    this.store.set(key, { expires: now + ttlMs, value });
    // Never cache failures: drop the entry so the next call retries.
    value.catch(() => {
      if (this.store.get(key)?.value === value) this.store.delete(key);
    });

    if (this.store.size > this.maxEntries) {
      const oldest = this.store.keys().next().value;
      if (oldest !== undefined) this.store.delete(oldest);
    }
    return value;
  }

  clear(): void {
    this.store.clear();
  }
}
