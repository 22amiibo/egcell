import { generateVariant } from "@/domain/challenges/generateVariant";
import type { ChallengeTemplate, ChallengeVariant } from "@/domain/challenges/variantTypes";
import type { DatasetTheme } from "@/domain/datasets/datasetTypes";
import type { RunTask, TaskQueue, TaskQueueRequest } from "@/domain/queue/queueTypes";
import { createRng } from "@/domain/random/rng";
import { taskSeed } from "@/domain/random/seeds";

export const QUEUE_VERSION = "q1";

/** The fastest a task can reasonably be, used to size a timed queue's overshoot. */
const MIN_TARGET_SECONDS = 4;
/** A timed task longer than this is a bad fit for a countdown, whatever the clock says. */
const TIMED_MAX_TARGET_SECONDS = 12;
const OVERSHOOT_SLACK = 4;
/** Draws per slot before the queue accepts a rule-bending pick. Termination beats purity. */
const PICK_ATTEMPTS = 10;

export type BuildTaskQueueInput = {
  request: TaskQueueRequest;
  templates: ChallengeTemplate[];
  themes: DatasetTheme[];
};

/**
 * A seeded, family-balanced, repetition-avoiding task queue. Same seed and version, same queue.
 *
 * Repetition rules: no template three times in a row nor more than about a third of the queue, no
 * target role three times in a row, at most two dataset themes per session, and the first slots
 * walk the families round-robin so a sprint always mixes them. Each rule bends rather than breaks:
 * after PICK_ATTEMPTS draws a slot accepts what it has, so a small pool still fills a queue.
 */
export function buildTaskQueue(input: BuildTaskQueueInput): TaskQueue {
  const { request } = input;
  const rng = createRng(request.seed);

  const pool = input.templates.filter((template) => {
    if (template.kind !== "seeded") {
      return false;
    }

    if (request.families !== undefined && !request.families.includes(template.family)) {
      return false;
    }

    return request.mode === "timed" ? template.timedEligible : template.sprintEligible;
  });

  if (pool.length === 0) {
    return { version: QUEUE_VERSION, seed: request.seed, mode: request.mode, tasks: [] };
  }

  // A timed queue cannot know how many tasks the player will reach, so it overshoots what a
  // superhuman pace could consume and the player plays a prefix. Nothing generates mid-run.
  const count =
    request.mode === "timed"
      ? Math.ceil((request.durationSeconds ?? 30) / MIN_TARGET_SECONDS) + OVERSHOOT_SLACK
      : (request.taskCount ?? 5);

  // Two themes per session, so the player is not re-reading a brand-new table every few seconds.
  const sessionThemes = rng
    .fork("themes")
    .shuffle(input.themes)
    .slice(0, Math.max(1, Math.min(2, input.themes.length)));

  const timedCap = Math.min(TIMED_MAX_TARGET_SECONDS, request.durationSeconds ?? Infinity);
  const perTemplateCap = Math.max(2, Math.ceil(count / 3));
  const familyOrder = rng.fork("families").shuffle([...new Set(pool.map((t) => t.family))]);

  const tasks: RunTask[] = [];
  const usedCounts = new Map<string, number>();
  const lastTemplates: string[] = [];
  const lastRoles: Array<string | undefined> = [];

  for (let index = 0; index < count; index += 1) {
    const pickRng = rng.fork(`pick/${index}`);
    let chosen: ChallengeVariant | null = null;
    let fallback: ChallengeVariant | null = null;

    for (let attempt = 0; attempt < PICK_ATTEMPTS && chosen === null; attempt += 1) {
      const family = index < familyOrder.length && attempt === 0 ? familyOrder[index] : null;

      let candidates = pool.filter((template) => {
        if (family !== null && template.family !== family) {
          return false;
        }

        if ((usedCounts.get(template.id) ?? 0) >= perTemplateCap) {
          return false;
        }

        // Two in a row is a Monkeytype-style repeat; three is a rut.
        return !(
          lastTemplates.length === 2 &&
          lastTemplates[0] === template.id &&
          lastTemplates[1] === template.id
        );
      });

      if (candidates.length === 0) {
        candidates = pool;
      }

      const template = pickRng.fork(`t${attempt}`).pick(candidates);
      const slotSeed = taskSeed(request.seed, index);
      const seed = attempt === 0 ? slotSeed : `${slotSeed}~${attempt}`;
      const variant = generateVariant({
        template,
        themes: sessionThemes,
        seed,
        difficulty: request.difficulty,
      });

      if (variant === null) {
        continue;
      }

      fallback = variant;

      if (request.mode === "timed" && variant.scoring.targetSeconds > timedCap) {
        continue;
      }

      const role = variant.dimensions.targetRole;

      if (
        role !== undefined &&
        lastRoles.length === 2 &&
        lastRoles[0] === role &&
        lastRoles[1] === role
      ) {
        continue;
      }

      chosen = variant;
    }

    const variant = chosen ?? fallback;

    if (variant === null) {
      continue;
    }

    tasks.push({ index: tasks.length, variant });
    usedCounts.set(variant.templateId, (usedCounts.get(variant.templateId) ?? 0) + 1);
    lastTemplates.push(variant.templateId);
    lastRoles.push(variant.dimensions.targetRole);

    if (lastTemplates.length > 2) {
      lastTemplates.shift();
    }

    if (lastRoles.length > 2) {
      lastRoles.shift();
    }
  }

  return { version: QUEUE_VERSION, seed: request.seed, mode: request.mode, tasks };
}
