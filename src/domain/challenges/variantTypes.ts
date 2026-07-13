import type {
  Challenge,
  ChallengeDifficulty,
  ChallengeFamily,
} from "@/domain/challenges/challengeTypes";
import type { DifficultyPreset } from "@/domain/challenges/difficulty";
import type { ColumnRole } from "@/domain/datasets/datasetTypes";
import type { NumberFormat, SortDirection } from "@/domain/grid/gridTypes";
import type { Rng } from "@/domain/random/rng";
import type { ChallengeSeed } from "@/domain/random/seeds";

/**
 * What a template varied to make one variant. The queue reads this to avoid repeating itself,
 * and tests read it to prove a template actually varies what it claims to.
 */
export type VariantDimensions = {
  themeId: string;
  /** Data rows, header excluded. */
  rowCount: number;
  colCount: number;
  columnOrder: ColumnRole[];
  distractorRoles: ColumnRole[];
  chainLength: number;
  targetRole?: ColumnRole;
  targetRowKind?: "first" | "last" | "byName" | "blank" | "corner";
  /** The label a byName target points at, so eligibility can re-check its uniqueness. */
  targetLabel?: string;
  sortKey?: ColumnRole;
  sortDirection?: SortDirection;
  filterRole?: ColumnRole;
  filterValue?: string | number;
  formatKind?: NumberFormat | "bold";
  headerIncluded?: boolean;
};

/**
 * A variant IS a challenge. Everything that runs, grades, scores, and records challenges keeps
 * consuming the type it already knows; the extra fields are provenance for the queue and tests.
 */
export type ChallengeVariant = Challenge & {
  templateId: string;
  templateVersion: string;
  dimensions: VariantDimensions;
  sprintEligible: boolean;
  timedEligible: boolean;
  leaderboardEligible: boolean;
};

/** Everything a template may draw from. All randomness comes from `rng`; nothing else varies. */
export type GenerationContext = {
  rng: Rng;
  seed: ChallengeSeed;
  difficulty: ChallengeDifficulty;
  preset: DifficultyPreset;
};

export type GeneratedChallenge = {
  variant: ChallengeVariant;
};

/**
 * A reusable, versioned, deterministic source of variants. Fixed templates wrap one hand-authored
 * challenge; seeded templates generate a fresh variant per seed. `generate` returns null when a
 * draw cannot produce an eligible variant, and the caller re-draws.
 */
export type ChallengeTemplate = {
  id: string;
  version: string;
  family: ChallengeFamily;
  /** Shown in pickers and docs. */
  label: string;
  kind: "fixed" | "seeded";
  /** The dimensions this template actually varies. Tests hold it to this claim. */
  varies: Array<keyof VariantDimensions>;
  sprintEligible: boolean;
  timedEligible: boolean;
  leaderboardEligible: boolean;
  generate(context: GenerationContext): GeneratedChallenge | null;
};

/** One failed eligibility check. A variant with any issue is re-drawn, never shipped. */
export type EligibilityIssue = {
  check: string;
  detail: string;
};
