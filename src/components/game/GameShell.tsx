"use client";

import Link from "next/link";
import { useCallback, useMemo, useRef, useState, useSyncExternalStore } from "react";

import { ChallengeRun } from "@/components/game/ChallengeRun";
import { SessionRun } from "@/components/game/SessionRun";
import { challengeAfter, challenges, defaultChallenge } from "@/data/challenges";
import { generateChallenge, generatedTemplates } from "@/data/challenges/generated";
import { SESSION_DIFFICULTY } from "@/data/challenges/queue";
import type {
  Challenge,
  ChallengeDifficulty,
  ChallengeMode,
} from "@/domain/challenges/challengeTypes";
import type { ChallengeVariant } from "@/domain/challenges/variantTypes";
import { recordKey } from "@/domain/records/personalRecords";
import type { SessionMode } from "@/domain/sessions/sessionTypes";
import type { FinishedRun } from "@/hooks/useGameRun";
import { useLocalPersonalRecords } from "@/hooks/useLocalPersonalRecords";
import { useLocalRunHistory } from "@/hooks/useLocalRunHistory";
import { useLocalSessionRecords } from "@/hooks/useLocalSessionRecords";
import { useSettings } from "@/hooks/useSettings";
import { formatElapsed, formatScore } from "@/lib/format";

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
const paramsCache: { value: URLSearchParams | null } = { value: null };

function subscribeToNothing(): () => void {
  return () => {};
}

function getParamsSnapshot(): URLSearchParams | null {
  if (paramsCache.value === null) {
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

export function GameShell() {
  const params = useSyncExternalStore(
    subscribeToNothing,
    getParamsSnapshot,
    getServerParamsSnapshot,
  );

  const urlChallenge = useMemo(() => {
    const templateId = params?.get("template");
    const seed = params?.get("seed");

    if (params === null || templateId == null || seed == null) {
      return null;
    }

    const parsed = Number(params.get("difficulty") ?? "2");
    const difficulty = GENERATED_DIFFICULTIES.includes(parsed as ChallengeDifficulty)
      ? (parsed as ChallengeDifficulty)
      : 2;

    return generateChallenge(templateId, seed, difficulty);
  }, [params]);

  // Null until the player picks something; the URL's challenge (if any) holds until then.
  const [picked, setPicked] = useState<Challenge | null>(null);
  const challenge = picked ?? urlChallenge ?? defaultChallenge;

  const [genDifficulty, setGenDifficulty] = useState<ChallengeDifficulty>(2);
  const drawCounter = useRef(0);

  const [play, setPlay] = useState<PlaySelection>(PLAY_OPTIONS[0].selection);
  const records = useLocalPersonalRecords();
  const sessionRecords = useLocalSessionRecords();
  const history = useLocalRunHistory();
  const { isHydrated: settingsReady } = useSettings();

  const { record: recordHistory } = history;

  // Every finished single run lands in the local run history, practice included.
  const recordSingleRun = useCallback(
    (finished: FinishedRun) => {
      recordHistory({
        modeKey: play.kind === "single" ? play.mode : "main-speed",
        label: challenge.title,
        score: finished.score.score,
        elapsedMs: finished.elapsedMs,
        completed: true,
        tasksCompleted: 1,
        isNewRecord: finished.isNewRecord,
      });
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
    setPicked((current) => challengeAfter(current ?? defaultChallenge));
  }, []);

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
      <header className="flex items-center justify-between gap-6 border-b border-line px-6 py-3">
        <span className="text-[13px] font-semibold tracking-tight text-ink">
          Excel Speed Trainer
        </span>

        <div className="flex items-center gap-5 text-[12px] text-muted">
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
        <div className="w-full max-w-4xl">
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
              seedOverride={params?.get("sessionSeed") ?? null}
            />
          ))}
        </div>
      </div>
    </main>
  );
}
