import type {
  CellAddress,
  CellFormat,
  FilterOp,
  GridActionKind,
  GridState,
  RangeAddress,
  SortDirection,
} from "@/domain/grid/gridTypes";

export type ChallengeFamily =
  | "navigation"
  | "selection"
  | "formatting"
  | "sort-filter"
  | "formula"
  | "mixed";
/**
 * Hotkey is an ordinary ranked mode with its own record book, not a modifier on Speed. Its records
 * are keyed by mode exactly as every other book's are, so a keyboard-only best can never be mistaken
 * for a mouse-assisted one — and a Speed best can never be beaten by a Hotkey run.
 */
export type ChallengeMode = "main-speed" | "practice" | "hotkey";
export type ChallengeDifficulty = 1 | 2 | 3 | 4 | 5;

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
export type LeafValidationSpec =
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

/**
 * A composite holds leaf specs only, never another composite, so grading can never recurse and a
 * mixed challenge stays two or three plain checks rather than a tree.
 */
export type ValidationSpec =
  | LeafValidationSpec
  | {
      kind: "composite";
      /** Every part must pass. Progress is the mean of the parts' completion. */
      parts: LeafValidationSpec[];
      /**
       * One short player-facing name per part, aligned by index. The result surfaces name the
       * unfinished step with these; without them a step is just "Step N".
       */
      partLabels?: string[];
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
  difficulty: ChallengeDifficulty;
  seed: string;
  timingPolicy: TimingPolicy;
  initialGrid: GridState;
  allowedActions: GridActionKind[];
  validation: ValidationSpec;
  scoring: ChallengeScoringConfig;
  practiceNotes: PracticeNote[];
};
