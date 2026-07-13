"use client";

import { useCallback, useState } from "react";

import { ChallengeRun } from "@/components/game/ChallengeRun";
import { SessionRun } from "@/components/game/SessionRun";
import { challengeAfter, challenges, defaultChallenge } from "@/data/challenges";
import type { Challenge, ChallengeMode } from "@/domain/challenges/challengeTypes";
import { recordKey } from "@/domain/records/personalRecords";
import type { SessionMode } from "@/domain/sessions/sessionTypes";
import { useLocalPersonalRecords } from "@/hooks/useLocalPersonalRecords";
import { useLocalSessionRecords } from "@/hooks/useLocalSessionRecords";
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
];

function selectionKey(selection: PlaySelection): string {
  return `${selection.kind}:${selection.mode}`;
}

export function GameShell() {
  const [challenge, setChallenge] = useState<Challenge>(defaultChallenge);
  const [play, setPlay] = useState<PlaySelection>(PLAY_OPTIONS[0].selection);
  const records = useLocalPersonalRecords();
  const sessionRecords = useLocalSessionRecords();

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
    const record = sessionRecords.records[play.mode];

    if (record !== undefined) {
      bestLabel = `best ${formatScore(record.bestScore)} pts`;
    }
  }

  const goToNext = useCallback(() => {
    setChallenge((current) => challengeAfter(current));
  }, []);

  const pick = useCallback((id: string) => {
    const picked = challenges.find((candidate) => candidate.id === id);

    if (picked !== undefined) {
      setChallenge(picked);
    }
  }, []);

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
                value={challenge.id}
                onChange={(event) => pick(event.target.value)}
                className="rounded border border-line bg-surface px-2 py-1 text-[12px] text-ink"
              >
                {challenges.map((candidate) => (
                  <option key={candidate.id} value={candidate.id}>
                    {candidate.title}
                  </option>
                ))}
              </select>
            </label>
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
        </div>
      </header>

      <div className="flex flex-1 justify-center px-6 py-10">
        <div className="w-full max-w-4xl">
          {/*
            Keyed by what is being played, so switching challenge, mode, or session length mounts
            a fresh run rather than inheriting the old clock, grid, and result.
          */}
          {play.kind === "single" ? (
            <ChallengeRun
              key={`${challenge.id}:${play.mode}`}
              challenge={challenge}
              mode={play.mode}
              records={records}
              onNext={goToNext}
            />
          ) : (
            <SessionRun
              key={selectionKey(play)}
              sessionMode={play.mode}
              personalRecords={records}
              sessionRecords={sessionRecords}
            />
          )}
        </div>
      </div>
    </main>
  );
}
