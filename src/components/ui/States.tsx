import type { ReactNode } from "react";

export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-md bg-surface-2 ${className}`} aria-hidden />;
}

/** Friendly inline error with an optional retry button. */
export function ErrorNotice({
  title = "Couldn't load data",
  message,
  onRetry,
}: {
  title?: string;
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div role="alert" className="rounded-xl border border-border bg-warn-soft p-4 text-sm text-warn-text">
      <p className="font-semibold">{title}</p>
      <p className="mt-1 opacity-90">{message}</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-3 rounded-lg border border-current px-3 py-1 text-xs font-medium hover:opacity-80"
        >
          Try again
        </button>
      )}
    </div>
  );
}

export function EmptyState({ children }: { children: ReactNode }) {
  return <div className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted">{children}</div>;
}
