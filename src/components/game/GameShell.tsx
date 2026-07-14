"use client";

import Link from "next/link";
import { useCallback, useMemo, useRef, useState, useSyncExternalStore } from "react";

import { ChallengeRun } from "@/components/game/ChallengeRun";
import { SessionRun } from "@/components/game/SessionRun";
import { challengeAfter, challenges, defaultChallenge } from "@/data/challenges";
import { generateChallenge, generatedTemplates } from "@/data/challenges/generated";
import {
  buildNormalSpeedQueue,
  SESSION_DIFFICULTY,
} from "@/data/challenges/queue";
import type {
  Challenge,
  ChallengeDifficulty,
  ChallengeMode,
} from "@/domain/challenges/challengeTypes";
import type { ChallengeVariant } from "@/domain/challenges/variantTypes";
import { recordKey } from "@/domain/records/personalRecords";
import { createNewSessionSeed } from "@/domain/random/seeds";
import { compareRoute } from "@/domain/routes/compareRoute";
import { getRoutes } from "@/domain/routes/routeCache";
import { runRecordForChallenge } from "@/domain/runs/runRecord";
import type { SessionMode } from "@/domain/sessions/sessionTypes";
import type { FinishedRun } from "@/hooks/useGameRun";
import { useLocalPersonalRecords } from "@/hooks/useLocalPersonalRecords";
import { useLocalSessionRecords } from "@/hooks/useLocalSessionRecords";
import { useRunLog } from "@/hooks/useRunLog";
import { useSettings } from "@/hooks/useSettings";
import { formatElapsed, formatScore } from "@/lib/format";
import { getPlatform } from "@/lib/platform";

/**
 * What the player is playing: one challenge at a time, or a session that strings tasks together
 * under a single clock. The two keep separate record books.
 */
type PlaySelection =
  | { kind: "single"; mode: ChallengeMode }
  | { kind: "session"; mode: SessionMode };

const PLAY_OPTIONS: Array<{ key: string; label: string; selection: PlaySelection }> = [
  { key: "speed", label: "Speed", selection: { kind: "single", mode: "main-speed" } },
  { key: "practice", label: "Practice", selection: { kind: "single", mode: "practice" } },
  { key: "hotkey", label: "Hotkey", selection: { kind: "single", mode: "hotkey" } },
  { key: "sprint-5", label: "Sprint 5", selection: { kind: "session", mode: "sprint-5" } },
  { key: "sprint-10", label: "Sprint 10", selection: { kind: "session", mode: "sprint-10" } },
  { key: "timed-30", label: "30s", selection: { kind: "session", mode: "timed-30" } },
  { key: "timed-60", label: "60s", selection: { kind: "session", mode: "timed-60" } },
];

function selectionKey(selection: PlaySelection): string {
  return `${selection.kind}:${selection.mode}`;
}

const GENERATED_DIFFICULTIES: ChallengeDifficulty[] = [1, 2, 3, 4, 5];

/**
 * The URL's search params, read once per page load through the same external-store pattern the
 * record stores use: the server snapshot is null, the browser fills it in after hydration, and no
 * state is set from an effect. `?template=<id>&seed=<seed>&difficulty=<1-5>` opens a
 * deterministic generated challenge, which is what makes e2e able to know the grid in advance.
 */
const paramsCache: { search: string | null; value: URLSearchParams | null } = {
  search: null,
  value: null,
};

function subscribeToNothing(): () => void {
  return () => {};
}

function getParamsSnapshot(): URLSearchParams | null {
  if (paramsCache.value === null || paramsCache.search !== window.location.search) {
    paramsCache.search = window.location.search;
    paramsCache.value = new URLSearchParams(window.location.search);
  }

  return paramsCache.value;
}

function getServerParamsSnapshot(): null {
  return null;
}

/** The seeded template behind a picked challenge, or null for a classic. */
function generatedTemplateIdOf(challenge: Challenge): string | null {
  const templateId = (challenge as Partial<ChallengeVariant>).templateId;

  return templateId !== undefined && templateId.startsWith("gen.") ? templateId : null;
}

type HydratedGameShellProps = {
  params: URLSearchParams;
  createSessionSeed: () => string;
};

function HydratedGameShell({ params, createSessionSeed }: HydratedGameShellProps) {
  const urlChallenge = useMemo(() => {
    const templateId = params?.get("template");
    const seed = params?.get("seed");

    if (templateId == null || seed == null) {
      return null;
    }

    const parsed = Number(params.get("difficulty") ?? "2");
    const difficulty = GENERATED_DIFFICULTIES.includes(parsed as ChallengeDifficulty)
      ? (parsed as ChallengeDifficulty)
      : 2;

    return generateChallenge(templateId, seed, difficulty);
  }, [params]);

  const [normalSessionSeed] = useState(
    () => params.get("sessionSeed") ?? createSessionSeed(),
  );
  const normalQueue = useMemo(
    () => buildNormalSpeedQueue(normalSessionSeed),
    [normalSessionSeed],
  );
  const [normalTaskIndex, setNormalTaskIndex] = useState(0);

  // Null until the player picks something; the URL's challenge (if any) holds until then.
  const [picked, setPicked] = useState<Challenge | null>(null);
  const normalChallenge = normalQueue.tasks[normalTaskIndex % normalQueue.tasks.length].variant;
  const challenge = picked ?? urlChallenge ?? normalChallenge;

  const [genDifficulty, setGenDifficulty] = useState<ChallengeDifficulty>(2);
  const drawCounter = useRef(0);

  const { settings, isHydrated: settingsReady } = useSettings();

  // The setting has existed, and rendered, and been saved, and been read by nobody. Honouring it is
  // two lines, and it waited for this phase only because the mode list was not complete until now.
  // Read once, as the initial state: a player who switches modes mid-session is not overruled by
  // their own default on the next render.
  const [play, setPlay] = useState<PlaySelection>(
    () =>
      PLAY_OPTIONS.find((option) => option.selection.mode === settings.gameplay.defaultMode)
        ?.selection ?? PLAY_OPTIONS[0].selection,
  );
  const records = useLocalPersonalRecords();
  const sessionRecords = useLocalSessionRecords();
  const history = useRunLog();

  const { record: recordHistory } = history;

  // Every finished single run lands in the run log, practice included.
  const recordSingleRun = useCallback(
    (finished: FinishedRun) => {
      // The run is over, so the solve is allowed to cost something here (§6.3) — and it costs it
      // once: `getRoutes` memoises per challenge and seed, so the result card mounting a moment
      // later reads the same entry instead of searching again.
      const routes = getRoutes(challenge);
      const comparison = compareRoute(finished.submission.replayEvents, routes, getPlatform());

      recordHistory(
        runRecordForChallenge({
          challenge,
          mode: play.kind === "single" ? play.mode : "main-speed",
          score: finished.score.score,
          elapsedMs: finished.elapsedMs,
          correctness: finished.validation.correctness,
          accuracy: finished.validation.accuracy,
          // Fired from `onFinished`, which only runs when the challenge is actually solved.
          isComplete: true,
          isNewRecord: finished.isNewRecord,
          eventDigest: finished.submission.eventDigest,
          comparison,
          // Read from the run rather than re-derived: the run is the only thing that knows whether
          // the player looked, and `getRunEligibility` reads this same field to unrank it.
          assist: finished.assist,
        }),
      );
    },
    [recordHistory, challenge, play],
  );

  // Records are keyed by mode, so a practice best can never be mistaken for a speed best, and
  // each session length keeps its own book. A single-challenge best reads as a time, a session
  // best as a score, because that is what each mode chases.
  let bestLabel = "no record yet";

  if (play.kind === "single") {
    const record = records.records[recordKey(challenge.id, play.mode)];

    if (record !== undefined) {
      bestLabel = `best ${formatElapsed(record.bestElapsedMs)}`;
    }
  } else {
    const record = sessionRecords.getBest(play.mode, SESSION_DIFFICULTY);

    if (record !== undefined) {
      bestLabel = `best ${formatScore(record.bestScore)} pts`;
    }
  }

  // A fresh seed per draw: the id (template + difficulty) stays stable so the record chase
  // survives, while the table underneath changes every time, like Monkeytype's words.
  const makeGenerated = useCallback((templateId: string, difficulty: ChallengeDifficulty) => {
    drawCounter.current += 1;

    const seed = `ui:${Date.now().toString(36)}:${drawCounter.current}`;
    const variant = generateChallenge(templateId, seed, difficulty);

    if (variant !== null) {
      setPicked(variant);
    }
  }, []);

  const goToNext = useCallback(() => {
    if (picked === null && urlChallenge === null) {
      setNormalTaskIndex((current) => (current + 1) % normalQueue.tasks.length);

      return;
    }

    setPicked((current) => challengeAfter(current ?? defaultChallenge));
  }, [normalQueue.tasks.length, picked, urlChallenge]);

  const pick = useCallback(
    (id: string) => {
      const classic = challenges.find((candidate) => candidate.id === id);

      if (classic !== undefined) {
        setPicked(classic);

        return;
      }

      makeGenerated(id, genDifficulty);
    },
    [makeGenerated, genDifficulty],
  );

  const generatedId = generatedTemplateIdOf(challenge);

  const changeDifficulty = useCallback(
    (difficulty: ChallengeDifficulty) => {
      setGenDifficulty(difficulty);

      if (generatedId !== null) {
        makeGenerated(generatedId, difficulty);
      }
    },
    [generatedId, makeGenerated],
  );

  return (
    <main className="flex min-h-screen flex-col">
      {/* Wraps rather than running off the edge. Unwrapped, this row was wider than a 1280px laptop
          and Settings hung off the right of the window — the page grew a horizontal scrollbar for the
          sake of a nav bar, and the whole layout could be dragged sideways. */}
      <header className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 border-b border-line px-6 py-3">
        <span className="text-[13px] font-semibold tracking-tight text-ink">
          Excel Speed Trainer
        </span>

        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[12px] text-muted">
          {play.kind === "single" && (
            <label className="flex items-center gap-2">
              <span className="sr-only">Challenge</span>
              <select
                aria-label="Challenge"
                value={generatedId ?? challenge.id}
                onChange={(event) => pick(event.target.value)}
                className="rounded border border-line bg-surface px-2 py-1 text-[12px] text-ink"
              >
                <optgroup label="Classic">
                  {challenges.map((candidate) => (
                    <option key={candidate.id} value={candidate.id}>
                      {candidate.title}
                    </option>
                  ))}
                </optgroup>
                <optgroup label="Generated">
                  {generatedTemplates.map((template) => (
                    <option key={template.id} value={template.id}>
                      {template.label}
                    </option>
                  ))}
                </optgroup>
              </select>
            </label>
          )}

          {play.kind === "single" && generatedId !== null && (
            <>
              <label className="flex items-center gap-2">
                <span className="sr-only">Difficulty</span>
                <select
                  aria-label="Difficulty"
                  value={challenge.difficulty}
                  onChange={(event) =>
                    changeDifficulty(Number(event.target.value) as ChallengeDifficulty)
                  }
                  className="rounded border border-line bg-surface px-2 py-1 text-[12px] text-ink"
                >
                  {GENERATED_DIFFICULTIES.map((difficulty) => (
                    <option key={difficulty} value={difficulty}>
                      Difficulty {difficulty}
                    </option>
                  ))}
                </select>
              </label>

              <button
                type="button"
                onClick={() => makeGenerated(generatedId, challenge.difficulty)}
                className="rounded border border-line px-2 py-1 text-[12px] font-medium text-muted transition-colors hover:bg-surface-raised hover:text-ink"
              >
                New draw
              </button>
            </>
          )}

          <div role="group" aria-label="Mode" className="flex items-center gap-1">
            {PLAY_OPTIONS.map((option) => (
              <button
                key={option.key}
                type="button"
                aria-pressed={selectionKey(play) === selectionKey(option.selection)}
                onClick={() => setPlay(option.selection)}
                className={[
                  "rounded border px-2 py-1 text-[12px] font-medium transition-colors",
                  selectionKey(play) === selectionKey(option.selection)
                    ? "border-accent bg-accent/15 text-ink"
                    : "border-line text-muted hover:bg-surface-raised hover:text-ink",
                ].join(" ")}
              >
                {option.label}
              </button>
            ))}
          </div>

          <span data-testid="best-time">{bestLabel}</span>

          <Link
            href="/profile"
            className="rounded border border-line px-2 py-1 text-[12px] font-medium text-muted transition-colors hover:bg-surface-raised hover:text-ink"
          >
            Profile
          </Link>

          <Link
            href="/leaderboard"
            className="rounded border border-line px-2 py-1 text-[12px] font-medium text-muted transition-colors hover:bg-surface-raised hover:text-ink"
          >
            Leaderboards
          </Link>

          <Link
            href="/settings"
            className="rounded border border-line px-2 py-1 text-[12px] font-medium text-muted transition-colors hover:bg-surface-raised hover:text-ink"
          >
            Settings
          </Link>
        </div>
      </header>

      <div className="flex flex-1 justify-center px-6 py-10">
        {/* Wide enough for a hard sheet. A difficulty-5 grid is around 1290px, and at 4xl (896px) the
            run column was narrower than the thing it holds — which is what pushed the grid out of its
            own container to begin with. It still scrolls inside itself when a sheet outgrows even
            this, but on a normal laptop the whole sheet now fits without scrolling at all. */}
        <div className="w-full max-w-6xl">
          {/*
            Keyed by what is being played, so switching challenge, mode, or session length mounts
            a fresh run rather than inheriting the old clock, grid, and result.
          */}
          {settingsReady && (play.kind === "single" ? (
            <ChallengeRun
              key={`${challenge.id}:${challenge.seed}:${play.mode}`}
              challenge={challenge}
              mode={play.mode}
              records={records}
              onNext={goToNext}
              onFinished={recordSingleRun}
            />
          ) : (
            <SessionRun
              key={selectionKey(play)}
              sessionMode={play.mode}
              personalRecords={records}
              sessionRecords={sessionRecords}
              recordHistory={recordHistory}
              seedOverride={params.get("sessionSeed")}
              createSessionSeed={createSessionSeed}
            />
          ))}
        </div>
      </div>
    </main>
  );
}

type GameShellProps = {
  /** Injectable so UI tests can prove seed selection without relying on real randomness. */
  createSessionSeed?: () => string;
};

export function GameShell({ createSessionSeed = createNewSessionSeed }: GameShellProps = {}) {
  const params = useSyncExternalStore(
    subscribeToNothing,
    getParamsSnapshot,
    getServerParamsSnapshot,
  );

  // The inner shell only mounts after hydration, so browser entropy is never created on the
  // server and URL overrides are known before the seed boundary runs.
  return params === null ? null : (
    <HydratedGameShell params={params} createSessionSeed={createSessionSeed} />
  );
}
