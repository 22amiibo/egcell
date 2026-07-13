"use client";

import type { Challenge } from "@/domain/challenges/challengeTypes";

/**
 * The prompt is the whole brief. No hint about the fast route ever appears here, because a hint
 * during a scored run would decide the run. Route notes belong in practice mode, after the fact.
 */
export function ChallengePrompt({ challenge }: { challenge: Challenge }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[11px] font-medium tracking-widest text-muted uppercase">
        {challenge.family}
      </span>
      <h1 className="text-xl font-semibold tracking-tight text-ink">{challenge.prompt}</h1>
    </div>
  );
}
