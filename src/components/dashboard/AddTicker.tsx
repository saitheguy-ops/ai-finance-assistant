"use client";

import { useEffect, useId, useState } from "react";

import { ApiError, errorMessage, fetchJson } from "@/lib/client/fetcher";
import { normalizeSymbol } from "@/lib/market/symbols";
import type { SearchResult, WatchlistEntry } from "@/lib/types";

/**
 * Text box for adding a ticker. Typing shows suggestions from /api/search;
 * submitting verifies the symbol has a real quote before adding it, so typos
 * like "APPL" are caught with a friendly message.
 */
export function AddTicker({ onAdd, existing }: { onAdd: (symbol: string) => void; existing: string[] }) {
  const [text, setText] = useState("");
  const [suggestions, setSuggestions] = useState<SearchResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const listId = useId();

  useEffect(() => {
    const q = text.trim();
    if (q.length < 1) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      fetchJson<{ results: SearchResult[] }>(`/api/search?q=${encodeURIComponent(q)}`, { signal: controller.signal })
        .then((r) => setSuggestions(r.results.slice(0, 6)))
        .catch(() => setSuggestions([])); // suggestions are optional
    }, 250);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [text]);

  async function submit(raw: string) {
    setError(null);
    const symbol = normalizeSymbol(raw);
    if (!symbol) {
      setError("Enter a ticker like AAPL or BRK-B.");
      return;
    }
    if (existing.includes(symbol)) {
      setError(`${symbol} is already on your watchlist.`);
      return;
    }
    setBusy(true);
    try {
      const res = await fetchJson<{ entries: WatchlistEntry[]; missing: string[] }>(
        `/api/quotes?symbols=${encodeURIComponent(symbol)}`,
      );
      if (res.entries.length === 0) {
        setError(`Couldn't find a ticker called ${symbol}.`);
        return;
      }
      onAdd(symbol);
      setText("");
      setSuggestions([]);
    } catch (err) {
      setError(err instanceof ApiError && err.code === "NOT_FOUND" ? `Couldn't find ${symbol}.` : errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      className="flex flex-col gap-1"
      onSubmit={(e) => {
        e.preventDefault();
        void submit(text);
      }}
    >
      <div className="flex gap-2">
        <label className="sr-only" htmlFor={`${listId}-input`}>
          Add a ticker
        </label>
        <input
          id={`${listId}-input`}
          list={listId}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            if (!e.target.value.trim()) setSuggestions([]);
          }}
          placeholder="Add ticker (e.g. AMD)"
          autoComplete="off"
          autoCapitalize="characters"
          className="min-w-0 flex-1 rounded-lg border border-border bg-bg px-3 py-2 text-sm outline-none focus:border-accent"
        />
        <datalist id={listId}>
          {suggestions.map((s) => (
            <option key={s.symbol} value={s.symbol}>
              {s.name} · {s.exchange}
            </option>
          ))}
        </datalist>
        <button
          type="submit"
          disabled={busy || !text.trim()}
          className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-contrast disabled:opacity-50"
        >
          {busy ? "Adding…" : "Add"}
        </button>
      </div>
      {error && (
        <p role="alert" className="text-xs text-down">
          {error}
        </p>
      )}
    </form>
  );
}
