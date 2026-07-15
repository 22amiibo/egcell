import { generateVariant } from "@/domain/challenges/generateVariant";
import type { ChallengeDifficulty } from "@/domain/challenges/challengeTypes";
import type { ChallengeTemplate, ChallengeVariant } from "@/domain/challenges/variantTypes";
import type { DatasetTheme } from "@/domain/datasets/datasetTypes";
import { createRng } from "@/domain/random/rng";
import { taskSeed } from "@/domain/random/seeds";
import { withTightenedTarget } from "@/domain/ascent/ascentScore";

const PICK_ATTEMPTS = 10;

export type AscentDrawInput = {
  runSeed: string;
  index: number;
  tier: ChallengeDifficulty;
  overdriveRungs: number;
  /** The last two template ids, so no drill lands three times in a row. */
  lastTemplateIds: string[];
  templates: ChallengeTemplate[];
  themes: DatasetTheme[];
};

/**
 * One task, drawn live at the ladder's current tier. Deterministic for a given
 * (runSeed, index, tier): a retry with the same seed climbs the same wall. Mirrors
 * buildTaskQueue's repetition rule and its two-theme trick; termination beats purity,
 * exactly as there.
 */
export function drawAscentTask(input: AscentDrawInput): ChallengeVariant | null {
  const pool = input.templates.filter(
    (template) => template.kind === "seeded" && template.sprintEligible,
  );

  if (pool.length === 0) {
    return null;
  }

  const rng = createRng(input.runSeed);
  const themes = rng
    .fork("themes")
    .shuffle(input.themes)
    .slice(0, Math.max(1, Math.min(2, input.themes.length)));
  const pickRng = rng.fork(`pick/${input.index}`);

  let fallback: ChallengeVariant | null = null;

  for (let attempt = 0; attempt < PICK_ATTEMPTS; attempt += 1) {
    const repeated =
      input.lastTemplateIds.length === 2 &&
      input.lastTemplateIds[0] === input.lastTemplateIds[1];
    const candidates = pool.filter(
      (template) => !(repeated && template.id === input.lastTemplateIds[1]),
    );
    const template = pickRng.fork(`t${attempt}`).pick(candidates);
    const slotSeed = taskSeed(input.runSeed, input.index);
    const variant = generateVariant({
      template,
      themes,
      seed: attempt === 0 ? slotSeed : `${slotSeed}~${attempt}`,
      difficulty: input.tier,
    });

    if (variant === null) {
      continue;
    }

    fallback = variant;

    if (input.lastTemplateIds.at(-1) !== variant.templateId) {
      return withTightenedTarget(variant, input.overdriveRungs);
    }
  }

  return fallback === null ? null : withTightenedTarget(fallback, input.overdriveRungs);
}
