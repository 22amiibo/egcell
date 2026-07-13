export function ShortcutFlash({ label }: { label: string }) {
  return (
    <kbd
      data-testid="shortcut-flash"
      className="absolute right-3 bottom-3 rounded border border-line-strong bg-surface/90 px-2 py-1 font-mono text-[10px] text-ink shadow-sm"
    >
      {label}
    </kbd>
  );
}
