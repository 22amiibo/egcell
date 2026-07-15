"use client";

import { useEffect, useRef, type CSSProperties } from "react";

type CellEditorProps = {
  buffer: string;
  /** The input's next full value; the state machine diffs it into chars/corrections. */
  onInput: (next: string) => void;
  onCommit: (chord: "Enter" | "Tab") => void;
  onCancel: () => void;
  /** Absolute position over the active cell, computed by the grid from its own metrics. */
  style: CSSProperties;
};

/**
 * The in-cell editor. A real focused <input> — the one place focus deliberately leaves the grid
 * container (IME and OS text services need it); commit and cancel hand focus straight back.
 */
export function CellEditor({ buffer, onInput, onCommit, onCancel, style }: CellEditorProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus({ preventScroll: true });
    inputRef.current?.setSelectionRange(buffer.length, buffer.length);
    // Focus once on mount; the buffer prop changing must not re-run this.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <input
      ref={inputRef}
      aria-label="Edit cell"
      className="absolute z-10 border-2 border-accent bg-surface px-1 font-mono text-[13px] text-ink outline-none"
      style={style}
      value={buffer}
      onChange={(event) => onInput(event.target.value)}
      onBlur={onCancel}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === "Tab") {
          event.preventDefault();
          event.stopPropagation();
          onCommit(event.key === "Tab" ? "Tab" : "Enter");
          return;
        }

        if (event.key === "Escape") {
          event.preventDefault();
          event.stopPropagation();
          onCancel();
        }
      }}
    />
  );
}
