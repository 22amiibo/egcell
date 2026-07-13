import type { ChallengeMode } from "@/domain/challenges/challengeTypes";
import { eventDigest } from "@/domain/runs/eventDigest";
import type { RunEvent } from "@/domain/runs/runTypes";

export const RUN_RESULT_VERSION = "v1";

/**
 * Everything a future leaderboard would need, and nothing else. No React state, no grid, no
 * functions: it is plain JSON, so it can be stored, logged, or posted without being reshaped.
 *
 * Nothing sends this anywhere. It is built and handed to the UI, and that is all. A server route,
 * accounts, and submission come later, and when they do the server must re-run the deterministic
 * validators against `replayEvents` rather than trust any number in here.
 */
export type RunResult = {
  resultVersion: string;
  challengeId: string;
  challengeVersion: string;
  seed: string;
  mode: ChallengeMode;
  score: number;
  elapsedMs: number;
  correctness: number;
  completionPercent: number;
  accuracy: number;
  /** ISO 8601. */
  clientStartedAt: string;
  /** ISO 8601. */
  clientFinishedAt: string;
  /** See eventDigest.ts. On its own this proves nothing. */
  eventDigest: string;
  replayEvents: RunEvent[];
};

export type BuildRunResultInput = {
  challengeId: string;
  challengeVersion: string;
  seed: string;
  mode: ChallengeMode;
  score: number;
  correctness: number;
  completionPercent: number;
  accuracy: number;
  startedAtMs: number;
  finishedAtMs: number;
  events: RunEvent[];
};

export function buildRunResult(input: BuildRunResultInput): RunResult {
  return {
    resultVersion: RUN_RESULT_VERSION,
    challengeId: input.challengeId,
    challengeVersion: input.challengeVersion,
    seed: input.seed,
    mode: input.mode,
    score: input.score,
    // Derived from the timestamps rather than passed in, so a submission's elapsed time and its two
    // stamps can never disagree with each other.
    elapsedMs: input.finishedAtMs - input.startedAtMs,
    correctness: input.correctness,
    completionPercent: input.completionPercent,
    accuracy: input.accuracy,
    clientStartedAt: new Date(input.startedAtMs).toISOString(),
    clientFinishedAt: new Date(input.finishedAtMs).toISOString(),
    eventDigest: eventDigest(input.events),
    replayEvents: input.events,
  };
}

export function serializeRunResult(result: RunResult): string {
  return JSON.stringify(result);
}
