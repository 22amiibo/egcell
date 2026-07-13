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

/** Visual-only feedback overlay. Absolute positioning guarantees it never changes grid geometry. */
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
      className="pointer-events-none absolute inset-0 z-10 overflow-hidden"
    >
      {event !== null && (
        <span
          className={`run-feedback-cue absolute top-3 left-1/2 -translate-x-1/2 rounded border bg-surface/90 px-2.5 py-1 text-[11px] font-semibold tracking-wide uppercase shadow-sm ${EVENT_COLORS[event]}`}
        >
          {EVENT_LABELS[event]}
        </span>
      )}
      {showCombo && <ComboIndicator combo={combo} />}
      {showShortcut && shortcutLabel !== null && <ShortcutFlash label={shortcutLabel} />}
    </div>
  );
}
