"use client";

import { useSyncExternalStore } from "react";

import { THEME_KEY } from "@/lib/theme";


const listeners = new Set<() => void>();
function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}
const isDark = () => document.documentElement.classList.contains("dark");

export function ThemeToggle() {
  // The server can't know the theme; render a neutral icon until hydrated.
  const dark = useSyncExternalStore(subscribe, isDark, () => null);

  function toggle() {
    const next = !isDark();
    document.documentElement.classList.toggle("dark", next);
    try {
      localStorage.setItem(THEME_KEY, next ? "dark" : "light");
    } catch {
      /* storage unavailable: the toggle still works for this visit */
    }
    listeners.forEach((l) => l());
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={dark ? "Switch to light theme" : "Switch to dark theme"}
      title="Toggle theme"
      className="grid h-9 w-9 place-items-center rounded-lg border border-border text-muted hover:text-text"
    >
      <span aria-hidden>{dark === null ? "◐" : dark ? "☀" : "☾"}</span>
    </button>
  );
}
