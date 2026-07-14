import { generatedTemplates } from "@/data/challenges/generated";
import { DATASET_THEMES } from "@/data/datasets/themes";
import type { ChallengeDifficulty } from "@/domain/challenges/challengeTypes";
import { buildTaskQueue } from "@/domain/queue/buildTaskQueue";
import type { TaskQueue } from "@/domain/queue/queueTypes";
import { queueSeed } from "@/domain/random/seeds";
import { SESSION_PLANS, type SessionMode } from "@/domain/sessions/sessionTypes";

/**
 * Every session runs at one difficulty for now, so a session record book compares like with
 * like. A difficulty picker for sessions can come later; the record key already carries it.
 */
export const SESSION_DIFFICULTY: ChallengeDifficulty = 2;
export const NORMAL_SPEED_QUEUE_SIZE = 10;

/**
 * Ordinary Speed play mixes the presets — mostly the familiar 2, with warm-up 1s, stretch 3s, and
 * one 4 — so runs stop being twenty variations of the same table. Sessions stay pinned at
 * SESSION_DIFFICULTY: their record book carries difficulty in its key and must compare like with
 * like. Per-challenge Speed PRs are safe because the challenge id embeds difficulty.
 */
export const SPEED_DIFFICULTY_MIX: ChallengeDifficulty[] = [2, 1, 3, 2, 2, 4, 2, 3, 1, 2];

/** A generated sequence for ordinary Speed play, pinned entirely by the supplied session seed. */
export function buildNormalSpeedQueue(run: string): TaskQueue {
  const seed = queueSeed("main-speed", 2, run);

  return buildTaskQueue({
    request: {
      mode: "single",
      seed,
      difficulty: 2,
      difficulties: SPEED_DIFFICULTY_MIX,
      taskCount: NORMAL_SPEED_QUEUE_SIZE,
    },
    templates: generatedTemplates,
    themes: DATASET_THEMES,
  });
}

/** The app-level binding of the pure queue builder to the shipped templates and themes. */
export function buildSessionQueue(mode: SessionMode, run: string): TaskQueue {
  const plan = SESSION_PLANS[mode];
  const seed = queueSeed(mode, SESSION_DIFFICULTY, run);

  return buildTaskQueue({
    request:
      plan.kind === "task-count"
        ? { mode: "sprint", seed, difficulty: SESSION_DIFFICULTY, taskCount: plan.taskCount }
        : {
            mode: "timed",
            seed,
            difficulty: SESSION_DIFFICULTY,
            durationSeconds: plan.durationSeconds,
          },
    templates: generatedTemplates,
    themes: DATASET_THEMES,
  });
}
