"use client";

import { FastestPathCard } from "@/components/game/FastestPathCard";
import type { Assist } from "@/hooks/useAssist";
import type { FastestPath } from "@/hooks/useFastestPath";

/**
 * The Help control's four states (§7.1).
 *
 * There is no disabled state. When the solver proved no route there is nothing to reveal, so the
 * button is *absent*: a disabled button nobody can explain is worse than no button, and it would
 * invite a player to keep clicking something that will never do anything.
 */
export function HelpControl({ assist, available }: { assist: Assist; available: boolean }) {
  if (!available) {
    return null;
  }

  if (assist.stage === "confirming") {
    return (
      <div className="flex items-center gap-2 text-[12px]" data-testid="help-confirm">
        <span className="text-warning">Unranks this run.</span>

        <button
          type="button"
          onClick={assist.confirm}
          className="rounded border border-line px-2 py-0.5 text-ink hover:border-accent-strong"
        >
          Reveal
        </button>

        <button
          type="button"
          onClick={assist.cancel}
          className="rounded border border-line px-2 py-0.5 text-muted hover:text-ink"
        >
          Cancel
        </button>
      </div>
    );
  }

  const revealed = assist.stage === "revealed";

  return (
    <>
      <button
        type="button"
        data-testid="help-control"
        onClick={revealed ? assist.toggle : assist.request}
        aria-keyshortcuts="?"
        // Hiding the panel is a display toggle, not an undo. A screen-reader user pressing "Hide"
        // must not be left believing they just handed the ranking back.
        aria-describedby={revealed ? "help-unranked-note" : undefined}
        className="rounded border border-line px-2 py-0.5 text-[12px] text-muted hover:text-ink"
      >
        {revealed && assist.visible ? "Hide fastest path" : "Show fastest path"}
      </button>

      {revealed && (
        <span id="help-unranked-note" className="sr-only">
          This run is unranked. Hiding the path does not change that.
        </span>
      )}
    </>
  );
}

/**
 * The revealed path (§7.2): the post-run card without the comparison rows, because mid-run there is
 * nothing to compare against — the run is still happening.
 *
 * The caller reserves this rail's width from mount, so revealing it cannot shove the grid sideways
 * under a player's hands.
 */
export function HelpPanel({ path }: { path: FastestPath | null }) {
  if (path === null) {
    return null;
  }

  return (
    <aside
      role="complementary"
      aria-label="Fastest path"
      data-testid="help-panel"
      className="w-64 rounded-lg border border-line bg-surface p-3"
    >
      <FastestPathCard path={path} showComparison={false} />
    </aside>
  );
}
