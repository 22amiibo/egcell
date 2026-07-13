"use client";

import { useCallback, useState } from "react";

import { ChallengePrompt } from "@/components/game/ChallengePrompt";
import { LiveStatsBar } from "@/components/game/LiveStatsBar";
import { ResultCard } from "@/components/game/ResultCard";
import {
  feedbackEventForRun,
  RunFeedbackLayer,
  shortcutLabelForEvent,
} from "@/components/game/RunFeedbackLayer";
import { TimerDisplay } from "@/components/game/TimerDisplay";
import { Toolbar } from "@/components/game/Toolbar";
import { SpreadsheetGrid } from "@/components/grid/SpreadsheetGrid";
import type { Challenge, ChallengeMode } from "@/domain/challenges/challengeTypes";
import { useGameRun, type FinishedRun } from "@/hooks/useGameRun";
import type { LocalPersonalRecords } from "@/hooks/useLocalPersonalRecords";
import { useSettings } from "@/hooks/useSettings";

type ChallengeRunProps = {
  challenge: Challenge;
  mode: ChallengeMode;
  records: LocalPersonalRecords;
  onNext: () => void;
  /** Fired once per completed run, so the shell can log it to the local history. */
  onFinished?: (finished: FinishedRun) => void;
};

/**
 * One run of one challenge. `GameShell` keys this by challenge id, so switching challenges mounts a
 * fresh run rather than carrying the old clock and grid across.
 */
export function ChallengeRun({ challenge, mode, records, onNext, onFinished }: ChallengeRunProps) {
  const run = useGameRun(challenge, mode, records, { onFinished });
  const { settings } = useSettings();
  const actionCount = run.events.length;
  const shortcutActionCount = run.events.filter(
    (event) => event.inputMethod === "keyboard",
  ).length;
  const mistakes = Math.round(actionCount * (1 - run.validation.accuracy));
  const feedbackEvent = feedbackEventForRun(run.events, run.validation, run.result !== null);

  // Retry remounts the grid. The grid keeps its keyboard anchor in refs, and a reset that left
  // the component mounted would leave those refs pointing at the last run's selection; a fresh
  // mount also re-fires the autofocus effect, so the player is straight back on the keys.
  const [attempt, setAttempt] = useState(0);

  const retry = useCallback(() => {
    run.retry();
    setAttempt((current) => current + 1);
  }, [run]);

  return (
    <div data-testid="practice-frame" className="flex flex-col items-center gap-4">
      <div
        data-testid="prompt-rail"
        className="flex min-h-14 w-full items-end justify-between gap-8"
      >
        <ChallengePrompt challenge={challenge} />
        <TimerDisplay startedAt={run.startedAt} frozenElapsedMs={run.result?.elapsedMs ?? null} />
      </div>

      <div className="flex w-full justify-start">
        <LiveStatsBar
          startedAt={run.startedAt}
          frozenElapsedMs={run.result?.elapsedMs ?? null}
          actions={actionCount}
          shortcutActions={shortcutActionCount}
          mistakes={mistakes}
          completedTasks={run.validation.completionPercent}
          totalTasks={1}
          pbMs={records.getBest(challenge.id, mode)?.bestElapsedMs ?? null}
          enabled={settings.feedback.liveStats}
        />
      </div>

      <div className="relative" data-testid="grid-stage">
        <SpreadsheetGrid
          key={attempt}
          grid={run.grid}
          onAction={run.dispatch}
          allowedActions={challenge.allowedActions}
        />
        <RunFeedbackLayer
          event={feedbackEvent}
          reducedMotion={settings.accessibility.reducedMotion}
          combo={actionCount - mistakes}
          shortcutLabel={shortcutLabelForEvent(run.events.at(-1))}
          showCombo={settings.feedback.combo}
          showShortcut={settings.feedback.shortcutFlash}
        />

        {run.result !== null && (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-canvas/70 backdrop-blur-[2px]">
            <ResultCard
              challenge={challenge}
              mode={mode}
              run={run.result}
              onRetry={retry}
              onNext={onNext}
            />
          </div>
        )}
      </div>

      <div className="flex min-h-9 w-full justify-start">
        <Toolbar challenge={challenge} grid={run.grid} onAction={run.dispatch} />
      </div>
    </div>
  );
}
