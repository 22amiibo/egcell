"use client";

/**
 * Focused on mount. The run is over the moment the result card appears, so the fastest way back
 * into another attempt is the key the player's hand is already on.
 */
export function RetryButton({ onRetry }: { onRetry: () => void }) {
  return (
    <button
      type="button"
      onClick={onRetry}
      autoFocus
      className="rounded-md bg-accent px-4 py-2 text-sm font-semibold text-canvas transition-colors hover:bg-accent-strong"
    >
      Retry
    </button>
  );
}
