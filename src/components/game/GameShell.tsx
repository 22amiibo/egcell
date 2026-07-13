"use client";

import { useCallback, useState } from "react";

import { ChallengeRun } from "@/components/game/ChallengeRun";
import { challengeAfter, challenges, defaultChallenge } from "@/data/challenges";
import type { Challenge, ChallengeMode } from "@/domain/challenges/challengeTypes";
import { recordKey } from "@/domain/records/personalRecords";
import { useLocalPersonalRecords } from "@/hooks/useLocalPersonalRecords";
import { formatElapsed } from "@/lib/format";

const MODES: Array<{ mode: ChallengeMode; label: string }> = [
  { mode: "main-speed", label: "Speed" },
  { mode: "practice", label: "Practice" },
];

export function GameShell() {
  const [challenge, setChallenge] = useState<Challenge>(defaultChallenge);
  const [mode, setMode] = useState<ChallengeMode>("main-speed");
  const records = useLocalPersonalRecords();

  // Records are keyed by mode, so a practice best can never be mistaken for a speed best.
  const best = records.records[recordKey(challenge.id, mode)];

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

          <div role="group" aria-label="Mode" className="flex items-center gap-1">
            {MODES.map((option) => (
              <button
                key={option.mode}
                type="button"
                aria-pressed={mode === option.mode}
                onClick={() => setMode(option.mode)}
                className={[
                  "rounded border px-2 py-1 text-[12px] font-medium transition-colors",
                  mode === option.mode
                    ? "border-accent bg-accent/15 text-ink"
                    : "border-line text-muted hover:bg-surface-raised hover:text-ink",
                ].join(" ")}
              >
                {option.label}
              </button>
            ))}
          </div>

          <span data-testid="best-time">
            {best === undefined ? "no record yet" : `best ${formatElapsed(best.bestElapsedMs)}`}
          </span>
        </div>
      </header>

      <div className="flex flex-1 justify-center px-6 py-10">
        <div className="w-full max-w-4xl">
          {/*
            Keyed by challenge and mode, so switching either one mounts a fresh run rather than
            inheriting the old clock, grid, and result.
          */}
          <ChallengeRun
            key={`${challenge.id}:${mode}`}
            challenge={challenge}
            mode={mode}
            records={records}
            onNext={goToNext}
          />
        </div>
      </div>
    </main>
  );
}
