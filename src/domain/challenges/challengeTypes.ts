import type {
  CellAddress,
  CellFormat,
  FilterOp,
  GridActionKind,
  GridState,
  RangeAddress,
  SortDirection,
} from "@/domain/grid/gridTypes";

export type ChallengeFamily = "navigation" | "selection" | "formatting" | "sort-filter" | "formula";
export type ChallengeMode = "main-speed" | "practice";

export type TimingPolicy =
  | { kind: "single-challenge"; targetSeconds: number }
  | { kind: "fixed-time"; durationSeconds: number };

/**
 * Validators are keyed by `kind`. A validator never sees a challenge id, so a challenge can be
 * renamed or reversioned without breaking the code that grades it.
 *
 * Every spec grades what the grid ends up looking like, not the route the player took to get there,
 * so a keyboard shortcut and a mouse click score the same.
 */
export type ValidationSpec =
  | {
      kind: "selection";
      requiredRange: RangeAddress;
      requireEntireColumnWithinUsedRange?: boolean;
    }
  | {
      kind: "navigation";
      requiredCell: CellAddress;
    }
  | {
      kind: "formatting";
      range: RangeAddress;
      requiredFormat: CellFormat;
    }
  | {
      kind: "sort-filter";
      /** The visible data rows must be ordered by this column. */
      requiredSort?: { col: number; direction: SortDirection };
      /** Exactly the data rows matching this predicate must be visible. */
      requiredVisible?: { col: number; op: FilterOp; value: string | number };
    };

export type ChallengeScoringConfig = {
  basePoints: number;
  targetSeconds: number;
  minimumCorrectnessForPr: number;
};

export type PracticeNote = {
  title: string;
  body: string;
};

export type Challenge = {
  id: string;
  version: string;
  slug: string;
  title: string;
  prompt: string;
  family: ChallengeFamily;
  difficulty: 1 | 2 | 3 | 4 | 5;
  seed: string;
  timingPolicy: TimingPolicy;
  initialGrid: GridState;
  allowedActions: GridActionKind[];
  validation: ValidationSpec;
  scoring: ChallengeScoringConfig;
  practiceNotes: PracticeNote[];
};
