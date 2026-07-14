import { ComboIndicator } from "@/components/game/ComboIndicator";
import { ShortcutFlash } from "@/components/game/ShortcutFlash";
import { chordLabel } from "@/domain/commands/keymap";
import type { RunEvent } from "@/domain/runs/runTypes";
import type { ValidationResult } from "@/domain/validation/validatorTypes";
import type { Platform } from "@/lib/platform";

export type RunFeedbackEvent =
  | "taskAppear"
  | "success"
  | "mistake"
  | "shortcut"
  | "combo"
  | "pbPace"
  | "runFinished";

type RunFeedbackLayerProps = {
  event: RunFeedbackEvent | null;
  reducedMotion: boolean;
  combo?: number;
  shortcutLabel?: string | null;
  showCombo?: boolean;
  showShortcut?: boolean;
};

const EVENT_LABELS: Record<RunFeedbackEvent, string> = {
  taskAppear: "Ready",
  success: "Correct",
  mistake: "Check input",
  shortcut: "Shortcut",
  combo: "Combo",
  pbPace: "PB pace",
  runFinished: "Run complete",
};

const EVENT_COLORS: Record<RunFeedbackEvent, string> = {
  taskAppear: "border-line-strong text-muted",
  success: "border-correct/50 text-correct",
  mistake: "border-error/50 text-error",
  shortcut: "border-accent/50 text-accent-strong",
  combo: "border-accent/50 text-accent-strong",
  pbPace: "border-correct/50 text-correct",
  runFinished: "border-correct/50 text-correct",
};

export function feedbackEventForRun(
  events: RunEvent[],
  validation: ValidationResult,
  finished: boolean,
): RunFeedbackEvent {
  if (finished) {
    return "runFinished";
  }

  const latest = events.at(-1);

  if (latest === undefined) {
    return "taskAppear";
  }

  if (validation.isComplete) {
    return "success";
  }

  if (latest.inputMethod === "keyboard") {
    return "shortcut";
  }

  return validation.messages.some((message) => message.kind === "error") ? "mistake" : "combo";
}

/**
 * The chord that actually fired, read from the command the input boundary minted — never guessed
 * from the resulting action the way the deleted `shortcutLabelForEvent` did (it said "Arrow key"
 * for a `Ctrl+↓`, because a `select-cell` action alone cannot tell you which). Gated on
 * `inputMethod === "keyboard"`, matching that function's original gate exactly: a toolbar click
 * has a command with a real keyboard binding too, and must not flash a chord it did not use.
 */
export function chordLabelForEvent(event: RunEvent | undefined, platform: Platform): string | null {
  if (event === undefined || event.inputMethod !== "keyboard" || event.command === undefined) {
    return null;
  }

  return chordLabel(event.command, platform);
}

/**
 * The feedback lane: a row of its own, directly above the grid.
 *
 * It used to be an `absolute inset-0` layer *over* the grid, with every cue pinned to a corner of
 * that box — the label at `top-3`, the streak at `top-3 right-3`, the chord at `bottom-3 right-3`.
 * Those are the coordinates of the column headers and the last row. So the cue reading CHECK INPUT
 * sat on top of the very column the player was being told to check, covering its filter caret.
 * Feedback that hides the thing it is about is worse than no feedback — and no offset fixes it,
 * because the overlay was exactly the size of the grid: every corner of it was a corner of the grid,
 * at every viewport.
 *
 * A lane cannot overlap anything, because it takes up space instead of floating over it. The height
 * is reserved whether or not a cue is showing, so the grid never jumps when one appears — which is
 * what the absolute positioning was really buying, and the only part of it worth keeping.
 */
export function RunFeedbackLayer({
  event,
  reducedMotion,
  combo = 0,
  shortcutLabel = null,
  showCombo = true,
  showShortcut = true,
}: RunFeedbackLayerProps) {
  return (
    <div
      data-testid="run-feedback-layer"
      data-event={event ?? "idle"}
      data-motion={reducedMotion ? "reduced" : "full"}
      aria-live="polite"
      className="pointer-events-none flex h-8 w-full shrink-0 items-center gap-2 overflow-hidden"
    >
      {event !== null && (
        <span
          className={`run-feedback-cue min-w-0 shrink truncate rounded border bg-surface/90 px-2.5 py-1 text-[11px] font-semibold tracking-wide uppercase shadow-sm ${EVENT_COLORS[event]}`}
        >
          {EVENT_LABELS[event]}
        </span>
      )}

      {/* Holds the two right-hand cues at the far end, so a long chord label eats the slack in the
          middle of the lane instead of pushing the streak counter out of it. */}
      <span className="flex-1" />

      {showShortcut && shortcutLabel !== null && <ShortcutFlash label={shortcutLabel} />}
      {showCombo && <ComboIndicator combo={combo} />}
    </div>
  );
}
