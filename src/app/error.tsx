"use client"; // Error boundaries must be Client Components

import { useEffect } from "react";

/** Catches unexpected rendering errors so one broken widget doesn't blank the app. */
export default function ErrorBoundary({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto max-w-md py-16 text-center">
      <h1 className="text-xl font-semibold">Something went wrong</h1>
      <p className="mt-2 text-sm text-muted">This page hit an unexpected error. Your paper portfolio is safe in your browser.</p>
      <button
        type="button"
        onClick={() => retry()}
        className="mt-6 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-contrast"
      >
        Try again
      </button>
    </div>
  );
}
