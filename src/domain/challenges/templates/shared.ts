import type {
  ChallengeFamily,
  PracticeNote,
  ValidationSpec,
} from "@/domain/challenges/challengeTypes";
import type {
  GeneratedChallenge,
  GenerationContext,
  VariantDimensions,
} from "@/domain/challenges/variantTypes";
import type { ColumnRole, GeneratedGrid } from "@/domain/datasets/datasetTypes";
import type { GridActionKind } from "@/domain/grid/gridTypes";
import type { Rng } from "@/domain/random/rng";

/**
 * Seconds and points grow gently with difficulty, so a difficulty-3 record chases a difficulty-3
 * pace. The real calibration pass is Phase I; these keep scores comparable until then.
 */
export function scaledSeconds(base: number, difficulty: number): number {
  return base + (difficulty - 1);
}

export function scaledPoints(base: number, difficulty: number): number {
  return base + (difficulty - 1) * 150;
}

/** A target column drawn from the roles the dataset actually placed. Null when none were. */
export function pickTargetColumn(
  rng: Rng,
  dataset: GeneratedGrid,
  candidates: ColumnRole[],
): { role: ColumnRole; col: number; header: string } | null {
  const placed = candidates.filter((role) => dataset.columnsByRole[role] !== undefined);

  if (placed.length === 0) {
    return null;
  }

  const role = rng.pick(placed);
  const col = dataset.columnsByRole[role] as number;

  return { role, col, header: dataset.headersByCol[col] };
}

/** The primary roles in on-grid order; distractors report as notes. Queue variety reads this. */
export function columnOrderOf(dataset: GeneratedGrid): ColumnRole[] {
  const roleByCol = new Map<number, ColumnRole>();

  for (const [role, col] of Object.entries(dataset.columnsByRole)) {
    roleByCol.set(col, role as ColumnRole);
  }

  const order: ColumnRole[] = [];

  for (let col = dataset.firstCol; col <= dataset.lastCol; col += 1) {
    order.push(roleByCol.get(col) ?? "note");
  }

  return order;
}

export type FinishVariantInput = {
  templateId: string;
  templateVersion: string;
  family: ChallengeFamily;
  title: string;
  context: GenerationContext;
  dataset: GeneratedGrid;
  prompt: string;
  validation: ValidationSpec;
  allowedActions: GridActionKind[];
  practiceNote: PracticeNote;
  targetSeconds: number;
  basePoints: number;
  dimensions?: Partial<VariantDimensions>;
};

/**
 * Assembles the variant every template returns. The id carries template and difficulty but never
 * the seed, so a personal record is keyed to the drill while the instance varies underneath it.
 */
export function finishVariant(input: FinishVariantInput): GeneratedChallenge {
  const { context, dataset } = input;
  const { difficulty } = context.preset;

  return {
    dataset,
    variant: {
      id: `${input.templateId}@${input.templateVersion}:d${difficulty}`,
      version: input.templateVersion,
      slug: `${input.templateId.replaceAll(".", "-")}-d${difficulty}`,
      title: input.title,
      prompt: input.prompt,
      family: input.family,
      difficulty,
      seed: context.seed,
      timingPolicy: { kind: "single-challenge", targetSeconds: input.targetSeconds },
      initialGrid: dataset.grid,
      allowedActions: input.allowedActions,
      validation: input.validation,
      scoring: {
        basePoints: input.basePoints,
        targetSeconds: input.targetSeconds,
        minimumCorrectnessForPr: 1,
      },
      practiceNotes: [input.practiceNote],
      templateId: input.templateId,
      templateVersion: input.templateVersion,
      dimensions: {
        themeId: dataset.themeId,
        rowCount: dataset.lastDataRow - dataset.firstDataRow + 1,
        colCount: dataset.lastCol - dataset.firstCol + 1,
        columnOrder: columnOrderOf(dataset),
        distractorRoles: dataset.distractorCols.map(() => "note" as const),
        chainLength: 1,
        ...input.dimensions,
      },
      sprintEligible: true,
      timedEligible: true,
      leaderboardEligible: true,
    },
  };
}

export const SELECTION_ACTIONS: GridActionKind[] = [
  "select-cell",
  "select-range",
  "select-row",
  "select-column",
];

export const NAVIGATION_ACTIONS: GridActionKind[] = ["select-cell"];
