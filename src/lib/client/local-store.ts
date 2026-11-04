/**
 * A tiny localStorage-backed store that works with React's
 * useSyncExternalStore. Each store:
 *  - reads and validates its JSON once, lazily, in the browser
 *  - notifies subscribers on every change (including other tabs)
 *  - falls back to the default value during server rendering or when
 *    storage is unavailable (private mode, quota, corrupted data)
 */
export interface LocalStore<T> {
  get(): T;
  getServerSnapshot(): T;
  set(next: T | ((prev: T) => T)): void;
  subscribe(listener: () => void): () => void;
}

export function createLocalStore<T>(
  key: string,
  fallback: T,
  validate: (raw: unknown) => T | null,
): LocalStore<T> {
  let cache: T | undefined;
  const listeners = new Set<() => void>();

  const read = (): T => {
    try {
      const raw = window.localStorage.getItem(key);
      if (raw === null) return fallback;
      return validate(JSON.parse(raw)) ?? fallback;
    } catch {
      return fallback;
    }
  };

  const emit = () => listeners.forEach((l) => l());

  const get = (): T => {
    if (typeof window === "undefined") return fallback;
    if (cache === undefined) cache = read();
    return cache;
  };

  return {
    get,
    getServerSnapshot: () => fallback,
    set(next) {
      const value = typeof next === "function" ? (next as (prev: T) => T)(get()) : next;
      cache = value;
      try {
        window.localStorage.setItem(key, JSON.stringify(value));
      } catch {
        // Storage full or blocked: keep the in-memory value for this session.
      }
      emit();
    },
    subscribe(listener) {
      listeners.add(listener);
      const onStorage = (e: StorageEvent) => {
        if (e.key === key) {
          cache = read();
          emit();
        }
      };
      window.addEventListener("storage", onStorage);
      return () => {
        listeners.delete(listener);
        window.removeEventListener("storage", onStorage);
      };
    },
  };
}
