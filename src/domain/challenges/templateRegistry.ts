import type {
  Challenge,
  ChallengeDifficulty,
  ChallengeFamily,
  ValidationSpec,
} from "@/domain/challenges/challengeTypes";
import { DIFFICULTY_PRESETS } from "@/domain/challenges/difficulty";
import type {
  ChallengeTemplate,
  ChallengeVariant,
  VariantDimensions,
} from "@/domain/challenges/variantTypes";
import type { DatasetTheme } from "@/domain/datasets/datasetTypes";
import type { GridActionKind } from "@/domain/grid/gridTypes";
import { createRng } from "@/domain/random/rng";
import type { ChallengeSeed } from "@/domain/random/seeds";

/**
 * The actions each validation-spec kind's solutions need. A challenge must allow at least one of
 * its spec's actions or the toolbar and keyboard would hide the only route to completion. The
 * registry test holds every challenge to this; the eligibility gate will hold every generated
 * variant to it too.
 */
export const SPEC_KIND_ACTIONS: Record<
  Exclude<ValidationSpec["kind"], "composite">,
  GridActionKind[]
> = {
  selection: ["select-cell", "select-range", "select-row", "select-column"],
  navigation: ["select-cell"],
  formatting: ["set-format"],
  "sort-filter": ["sort-column", "filter-column"],
  "cell-value": ["select-cell", "set-cell-value"],
  formula: ["select-cell", "set-cell-value"],
};

export type TemplateRegistry = {
  /** Every template, in registration order. Registration order is load-bearing for the classics. */
  all(): ChallengeTemplate[];
  byId(id: string): ChallengeTemplate | undefined;
  byFamily(family: ChallengeFamily): ChallengeTemplate[];
  families(): ChallengeFamily[];
};

/** The one place a template is looked up. Throws on a duplicate id at construction. */
export function createTemplateRegistry(templates: ChallengeTemplate[]): TemplateRegistry {
  const byId = new Map<string, ChallengeTemplate>();

  for (const template of templates) {
    if (byId.has(template.id)) {
      throw new Error(`Duplicate template id: ${template.id}.`);
    }

    byId.set(template.id, template);
  }

  return {
    all: () => [...templates],
    byId: (id) => byId.get(id),
    byFamily: (family) => templates.filter((template) => template.family === family),
    families: () => [...new Set(templates.map((template) => template.family))],
  };
}

/**
 * The dimensions of the one hand-authored dataset. Every fixed template reports them, so queue
 * logic can treat classics and generated variants uniformly.
 */
const CLASSIC_DIMENSIONS: VariantDimensions = {
  themeId: "classic-revenue",
  rowCount: 6,
  colCount: 5,
  columnOrder: ["category", "name", "amount", "count", "status"],
  distractorRoles: [],
  chainLength: 1,
};

/**
 * Wraps one hand-authored challenge as a template with a single pinned outcome. The variant keeps
 * the challenge's own id and seed, so every existing personal record still resolves.
 */
export function fixedTemplate(challenge: Challenge): ChallengeTemplate {
  const variant: ChallengeVariant = {
    ...challenge,
    templateId: challenge.id,
    templateVersion: challenge.version,
    dimensions: {
      ...CLASSIC_DIMENSIONS,
      chainLength:
        challenge.validation.kind === "composite" ? challenge.validation.parts.length : 1,
    },
    sprintEligible: true,
    timedEligible: true,
    leaderboardEligible: true,
  };

  return {
    id: challenge.id,
    version: challenge.version,
    family: challenge.family,
    label: challenge.title,
    kind: "fixed",
    varies: [],
    sprintEligible: true,
    timedEligible: true,
    leaderboardEligible: true,
    generate: () => ({ variant }),
  };
}

/**
 * Runs a template once for a seed and difficulty. This is the single path from template to
 * playable variant; fixed templates ignore the draw and return their pinned challenge.
 */
export function materializeTemplate(
  template: ChallengeTemplate,
  seed: ChallengeSeed,
  difficulty: ChallengeDifficulty,
  themes: DatasetTheme[] = [],
): ChallengeVariant | null {
  const generated = template.generate({
    rng: createRng(seed),
    seed,
    difficulty,
    preset: DIFFICULTY_PRESETS[difficulty],
    themes,
  });

  return generated?.variant ?? null;
}
