export function ComboIndicator({ combo }: { combo: number }) {
  if (combo < 2) {
    return null;
  }

  return (
    <span
      data-testid="combo-indicator"
      className="absolute top-3 right-3 rounded border border-accent/40 bg-surface/90 px-2 py-1 text-[11px] font-semibold tabular-nums text-accent-strong shadow-sm"
    >
      {combo} streak
    </span>
  );
}
