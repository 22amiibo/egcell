export function ComboIndicator({ combo }: { combo: number }) {
  if (combo < 2) {
    return null;
  }

  return (
    // Placed by the feedback lane, not by itself: `top-3 right-3` used to land this on top of the
    // grid's last column header.
    <span
      data-testid="combo-indicator"
      className="shrink-0 rounded border border-accent/40 bg-surface/90 px-2 py-1 text-[11px] font-semibold tabular-nums whitespace-nowrap text-accent-strong shadow-sm"
    >
      {combo} streak
    </span>
  );
}
