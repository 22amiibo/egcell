export function ShortcutFlash({ label }: { label: string }) {
  return (
    // Placed by the feedback lane. `bottom-3 right-3` used to put the chord over the grid's last
    // row — the one a Ctrl+↓ had just jumped to, so the flash covered its own destination.
    // `truncate` keeps a long chord label inside the lane rather than widening it.
    <kbd
      data-testid="shortcut-flash"
      className="min-w-0 shrink truncate rounded border border-line-strong bg-surface/90 px-2 py-1 font-mono text-[10px] text-ink shadow-sm"
    >
      {label}
    </kbd>
  );
}
