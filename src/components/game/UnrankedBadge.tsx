/**
 * What replaces the personal-best chip the moment help is revealed (§7.3).
 *
 * It cannot be dismissed and it does not soften. The player traded this attempt's ranking for the
 * answer; the interface owes them a plain statement of that for as long as the attempt lasts — not
 * a toast that vanishes before they look up from the grid.
 */
export function UnrankedBadge() {
  return (
    <span
      data-testid="unranked-badge"
      className="rounded border border-warning/40 bg-warning/10 px-1.5 py-0.5 text-[11px] font-medium uppercase tracking-wide text-warning"
    >
      Unranked · assisted
    </span>
  );
}
