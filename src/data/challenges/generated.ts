import { DATASET_THEMES } from "@/data/datasets/themes";
import type { ChallengeDifficulty } from "@/domain/challenges/challengeTypes";
import { generateVariant } from "@/domain/challenges/generateVariant";
import { formattingTemplates } from "@/domain/challenges/templates/formatting";
import { navigationTemplates } from "@/domain/challenges/templates/navigation";
import { selectionTemplates } from "@/domain/challenges/templates/selection";
import { sortFilterTemplates } from "@/domain/challenges/templates/sortFilter";
import type { ChallengeTemplate, ChallengeVariant } from "@/domain/challenges/variantTypes";
import type { ChallengeSeed } from "@/domain/random/seeds";

/** Every seeded template the game offers, in picker order. */
export const generatedTemplates: ChallengeTemplate[] = [
  ...navigationTemplates,
  ...selectionTemplates,
  ...formattingTemplates,
  ...sortFilterTemplates,
];

/**
 * The app-level binding of the pure generator to the shipped themes. UI and tests call this; the
 * domain stays injectable.
 */
export function generateChallenge(
  templateId: string,
  seed: ChallengeSeed,
  difficulty: ChallengeDifficulty,
): ChallengeVariant | null {
  const template = generatedTemplates.find((candidate) => candidate.id === templateId);

  if (template === undefined) {
    return null;
  }

  return generateVariant({ template, themes: DATASET_THEMES, seed, difficulty });
}
