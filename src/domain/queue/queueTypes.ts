import type { ChallengeDifficulty, ChallengeFamily } from "@/domain/challenges/challengeTypes";
import type { ChallengeVariant } from "@/domain/challenges/variantTypes";
import type { ChallengeSeed } from "@/domain/random/seeds";

export type RunModeKind = "single" | "practice" | "sprint" | "timed" | "daily";

export type TaskQueueRequest = {
  mode: RunModeKind;
  seed: ChallengeSeed;
  difficulty: ChallengeDifficulty;
  /** Sprint: exactly this many tasks. */
  taskCount?: number;
  /** Timed: the clock the queue must outlast. */
  durationSeconds?: number;
  /** Practice targeting: restrict the pool to these families. */
  families?: ChallengeFamily[];
};

export type RunTask = {
  index: number;
  variant: ChallengeVariant;
};

export type TaskQueue = {
  /** Bumping this deliberately breaks comparability between old and new queues. */
  version: string;
  seed: ChallengeSeed;
  mode: RunModeKind;
  tasks: RunTask[];
};
