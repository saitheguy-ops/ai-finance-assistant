/** Shown on every page. Kept short so people actually read it. */
export function DisclaimerBanner() {
  return (
    <div className="border-b border-border bg-warn-soft text-warn-text">
      <p className="mx-auto max-w-6xl px-4 py-1.5 text-center text-xs">
        <strong>Educational project, not financial advice.</strong> Paper trading uses fake money only; no real
        trades are ever placed. Market data from Yahoo Finance may be delayed.
      </p>
    </div>
  );
}
