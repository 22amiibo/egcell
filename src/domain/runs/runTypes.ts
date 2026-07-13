import type { ChallengeMode } from "@/domain/challenges/challengeTypes";
import type { GridAction } from "@/domain/grid/gridTypes";

export type RunStatus = "idle" | "running" | "complete";

/** One player action, stamped with milliseconds since the run started. */
export type RunEvent = {
  atMs: number;
  action: GridAction;
};

export type RunState = {
  challengeId: string;
  challengeVersion: string;
  seed: string;
  mode: ChallengeMode;
  status: RunStatus;
  /** Epoch milliseconds. Null until the player's first action starts the clock. */
  startedAt: number | null;
  /** Epoch milliseconds. Null until the run completes. */
  finishedAt: number | null;
  elapsedMs: number;
  events: RunEvent[];
};
