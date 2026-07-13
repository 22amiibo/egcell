"use client";

/**
 * The one loud element on a result card. A new record is the payoff the whole game is built
 * around, so it gets a badge readable at a glance rather than a sentence the eye has to find.
 */
export function NewPrBadge() {
  return (
    <span
      data-testid="pr-badge"
      className="rounded-full bg-accent px-2 py-0.5 text-[10px] font-bold tracking-widest text-canvas uppercase"
    >
      New PR
    </span>
  );
}
