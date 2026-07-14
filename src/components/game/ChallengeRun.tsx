"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";

import { ChallengePrompt } from "@/components/game/ChallengePrompt";
import { HelpControl, HelpPanel } from "@/components/game/HelpPanel";
import { LiveStatsBar } from "@/components/game/LiveStatsBar";
import { ResultCard } from "@/components/game/ResultCard";
import { UnrankedBadge } from "@/components/game/UnrankedBadge";
import {
  chordLabelForEvent,
  feedbackEventForRun,
  RunFeedbackLayer,
} from "@/components/game/RunFeedbackLayer";
import { TimerDisplay } from "@/components/game/TimerDisplay";
import { Toolbar } from "@/components/game/Toolbar";
import { SpreadsheetGrid } from "@/components/grid/SpreadsheetGrid";
import type { Challenge, ChallengeMode } from "@/domain/challenges/challengeTypes";
import { hotkeyVerdict } from "@/domain/routes/hotkeyEligibility";
import { getRoutes } from "@/domain/routes/routeCache";
import { useAssist } from "@/hooks/useAssist";
import { useFastestPath } from "@/hooks/useFastestPath";
import { useGameRun, type FinishedRun } from "@/hooks/useGameRun";
import type { LocalPersonalRecords } from "@/hooks/useLocalPersonalRecords";
import { useSettings } from "@/hooks/useSettings";
import { getPlatform } from "@/lib/platform";
import { getSoundCue, playSoundCue, soundEventForFeedback } from "@/lib/sound/runSounds";

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
  const { settings } = useSettings();
  const assist = useAssist({
    autoReveal: mode === "practice" && settings.help.autoRevealInPractice,
    confirmBeforeReveal: settings.help.confirmBeforeReveal,
  });
  const hotkey = mode === "hotkey";
  const strictness = settings.scoring.hotkeyStrictness;
  // The count is a property of the challenge, not of the player, so showing it before the run gives
  // nothing away and is not assistance (§7.4). It is also the one place the solver runs *before* a
  // run rather than after — memoised per challenge and seed, so it is paid once.
  const hotkeyRoutes = useMemo(() => (hotkey ? getRoutes(challenge) : null), [hotkey, challenge]);
  const run = useGameRun(challenge, mode, records, {
    onFinished,
    assist: assist.assist,
    // A pointer-tainted Hotkey run still plays, still grades, and still scores. It simply banks no
    // Hotkey record: route quality and correctness never touch (§6.2).
    requireKeyboardPure: hotkey && strictness !== "encouraged",
  });
  const verdict = hotkeyVerdict(run.events, strictness);
  const blockPointer = hotkey && verdict.blocksPointer;
  // The solve is paid for only once the run is already unranked, so it can never cost a scored run a
  // frame (§6.3) — `useFastestPath` takes that as a parameter rather than as a promise.
  const path = useFastestPath(challenge, run.events, assist.stage === "revealed");
  // Toolbar clicks steal DOM focus (§2.3 fact 3 of the plan); this is how it's returned so a
  // hybrid keyboard+toolbar route doesn't go dead mid-run.
  const gridFocusRef = useRef<HTMLDivElement>(null);
  const actionCount = run.events.length;
  const shortcutActionCount = run.events.filter(
    (event) => event.inputMethod === "keyboard",
  ).length;
  const mistakes = Math.round(actionCount * (1 - run.validation.accuracy));
  const feedbackEvent = feedbackEventForRun(run.events, run.validation, run.result !== null);

  useEffect(() => {
    const soundEvent = soundEventForFeedback(feedbackEvent);

    playSoundCue(soundEvent === null ? null : getSoundCue(soundEvent, settings.sound));
  }, [feedbackEvent, run.events.length, settings.sound]);

  // Retry remounts the grid. The grid keeps its keyboard anchor in refs, and a reset that left
  // the component mounted would leave those refs pointing at the last run's selection; a fresh
  // mount also re-fires the autofocus effect, so the player is straight back on the keys.
  const [attempt, setAttempt] = useState(0);

  const retry = useCallback(() => {
    run.retry();
    setAttempt((current) => current + 1);
  }, [run]);

  // `?` asks for help, `Escape` backs out of the confirmation. This listens on the run surface, not
  // inside the grid: the grid owns the game's keys, and a help shortcut buried in its keydown
  // handler would be a key the grid has to know about but does not own.
  const onKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key === "?" && assist.stage !== "revealed") {
      event.preventDefault();
      assist.request();
      return;
    }

    if (event.key === "Escape" && assist.stage === "confirming") {
      event.preventDefault();
      assist.cancel();
    }
  };

  return (
    <div
      data-testid="practice-frame"
      onKeyDown={onKeyDown}
      className="flex flex-col items-center gap-4"
    >
      <div
        data-testid="prompt-rail"
        className="flex min-h-14 w-full items-end justify-between gap-8"
      >
        <div className="flex flex-col gap-1">
          <ChallengePrompt challenge={challenge} />

          {hotkey && (
            <p className="text-[11px] text-muted" data-testid="hotkey-objective">
              {hotkeyRoutes === null
                ? "Keyboard only"
                : `Keyboard only · ${hotkeyRoutes[0].optimalActions} optimal action${
                    hotkeyRoutes[0].optimalActions === 1 ? "" : "s"
                  }`}
              {blockPointer && " · the pointer is off in this mode"}
            </p>
          )}
        </div>

        <div className="flex items-center gap-3">
          {assist.stage === "revealed" && <UnrankedBadge />}
          <HelpControl assist={assist} available={run.result === null} />
          <TimerDisplay startedAt={run.startedAt} frozenElapsedMs={run.result?.elapsedMs ?? null} />
        </div>
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

      {/* The one live region on this surface already belongs to RunFeedbackLayer, so the unranked
          announcement is made here as its own polite region rather than by adding a second shouting
          match over the same words. It is announced once, when the reveal happens. */}
      <p className="sr-only" role="status" aria-live="polite">
        {assist.stage === "revealed" ? "Fastest path revealed. This run is now unranked." : ""}
      </p>

      <div className="flex items-start gap-4">
        <div className="relative" data-testid="grid-stage">
        <SpreadsheetGrid
          key={attempt}
          grid={run.grid}
          onAction={run.dispatch}
          allowedActions={challenge.allowedActions}
          focusRef={gridFocusRef}
          pointerDisabled={blockPointer}
          density={settings.grid.density}
          gridlineStrength={settings.grid.gridlineStrength}
          largeTargets={settings.accessibility.largeTargets}
        />
        <RunFeedbackLayer
          event={feedbackEvent}
          reducedMotion={settings.accessibility.reducedMotion}
          combo={actionCount - mistakes}
          shortcutLabel={chordLabelForEvent(run.events.at(-1), getPlatform())}
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

        {/* The rail's width is held from mount, so revealing the path cannot shift the grid sideways
            under the player's hands mid-run (§7.2). Below 1024px it drops under the grid instead. */}
        <div className="hidden w-64 shrink-0 lg:block">
          {assist.visible && run.result === null && <HelpPanel path={path} />}
        </div>
      </div>

      <div className="w-full lg:hidden">
        {assist.visible && run.result === null && <HelpPanel path={path} />}
      </div>

      <div className="flex min-h-9 w-full justify-start">
        <Toolbar
          challenge={challenge}
          grid={run.grid}
          onAction={run.dispatch}
          gridFocusRef={gridFocusRef}
          pointerDisabled={blockPointer}
        />
      </div>
    </div>
  );
}
