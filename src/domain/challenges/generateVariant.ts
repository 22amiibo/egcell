import type { ChallengeDifficulty } from "@/domain/challenges/challengeTypes";
import { DIFFICULTY_PRESETS } from "@/domain/challenges/difficulty";
import { checkVariant } from "@/domain/challenges/eligibility";
import type { ChallengeTemplate, ChallengeVariant } from "@/domain/challenges/variantTypes";
import type { DatasetTheme } from "@/domain/datasets/datasetTypes";
import { createRng } from "@/domain/random/rng";
import type { ChallengeSeed } from "@/domain/random/seeds";

export type GenerateVariantInput = {
  template: ChallengeTemplate;
  themes: DatasetTheme[];
  seed: ChallengeSeed;
  difficulty: ChallengeDifficulty;
};

/** Attempts per difficulty before falling back a level. Bounded, so generation always ends. */
const MAX_ATTEMPTS = 8;

/**
 * The one path from template and seed to a playable variant. A draw the eligibility gate rejects
 * is re-drawn on a derived seed; when a difficulty is exhausted the next one down is tried, so a
 * template that cannot satisfy a hard preset still produces something playable rather than
 * nothing. Deterministic end to end: same input, same walk, same variant.
 */
export function generateVariant(input: GenerateVariantInput): ChallengeVariant | null {
  for (let difficulty = input.difficulty; difficulty >= 1; difficulty -= 1) {
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
      const isFirst = attempt === 0 && difficulty === input.difficulty;
      const seed = isFirst ? input.seed : `${input.seed}/r${difficulty}a${attempt}`;

      const generated = input.template.generate({
        rng: createRng(seed),
        seed,
        difficulty: difficulty as ChallengeDifficulty,
        preset: DIFFICULTY_PRESETS[difficulty as ChallengeDifficulty],
        themes: input.themes,
      });

      if (generated === null) {
        continue;
      }

      if (checkVariant({ variant: generated.variant, dataset: generated.dataset }).length === 0) {
        return generated.variant;
      }
    }
  }

  return null;
}
