"use client";

import { RANGES, type Range } from "@/lib/types";

export function RangeTabs({ value, onChange }: { value: Range; onChange: (r: Range) => void }) {
  return (
    <div role="tablist" aria-label="Chart range" className="inline-flex rounded-lg bg-surface-2 p-0.5 text-xs">
      {RANGES.map((r) => (
        <button
          key={r}
          type="button"
          role="tab"
          aria-selected={r === value}
          onClick={() => onChange(r)}
          className={`rounded-md px-2.5 py-1 font-medium ${
            r === value ? "bg-surface text-text shadow-sm" : "text-muted hover:text-text"
          }`}
        >
          {r}
        </button>
      ))}
    </div>
  );
}
