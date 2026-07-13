"use client";

import { useCallback, useState } from "react";

import { ChallengeRun } from "@/components/game/ChallengeRun";
import { challengeAfter, challenges, defaultChallenge } from "@/data/challenges";
import type { Challenge, ChallengeMode } from "@/domain/challenges/challengeTypes";
import { recordKey } from "@/domain/records/personalRecords";
import { useLocalPersonalRecords } from "@/hooks/useLocalPersonalRecords";
import { formatElapsed } from "@/lib/format";

const MODE: ChallengeMode = "main-speed";

export function GameShell() {
  const [challenge, setChallenge] = useState<Challenge>(defaultChallenge);
  const records = useLocalPersonalRecords();

  const best = records.records[recordKey(challenge.id, MODE)];

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

          <span>main speed</span>

          <span data-testid="best-time">
            {best === undefined ? "no record yet" : `best ${formatElapsed(best.bestElapsedMs)}`}
          </span>
        </div>
      </header>

      <div className="flex flex-1 justify-center px-6 py-10">
        <div className="w-full max-w-4xl">
          {/* Keyed by challenge, so switching mounts a fresh run instead of inheriting the old clock. */}
          <ChallengeRun
            key={challenge.id}
            challenge={challenge}
            mode={MODE}
            records={records}
            onNext={goToNext}
          />
        </div>
      </div>
    </main>
  );
}
