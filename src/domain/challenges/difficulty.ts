import type { ChallengeDifficulty } from "@/domain/challenges/challengeTypes";

/**
 * Difficulty pins the shape of the work, never the clarity of the prompt. Personal records are
 * keyed by template and difficulty, so two variants at the same difficulty must be the same
 * amount of work: these bands are what "the same amount" means.
 */
export type DifficultyPreset = {
  difficulty: ChallengeDifficulty;
  /** Data rows, header excluded. */
  rows: [min: number, max: number];
  /** Total columns, distractors included. */
  cols: [min: number, max: number];
  distractorColumns: [min: number, max: number];
  /** Similar-looking headers ("Revenue" next to "Revenue LY"). */
  confusables: boolean;
  /** Blank cells inside the data block, so edge-jumps stop early. */
  blanks: boolean;
  /** Steps in a mixed chain. [1, 1] for every single-family template. */
  chainLength: [min: number, max: number];
  /** Whether the table may start away from A1. */
  tableOffset: boolean;
};

export const DIFFICULTY_PRESETS: Record<ChallengeDifficulty, DifficultyPreset> = {
  1: {
    difficulty: 1,
    rows: [5, 7],
    cols: [4, 5],
    distractorColumns: [0, 0],
    confusables: false,
    blanks: false,
    chainLength: [1, 1],
    tableOffset: false,
  },
  2: {
    difficulty: 2,
    rows: [7, 10],
    cols: [5, 6],
    distractorColumns: [0, 1],
    confusables: false,
    blanks: false,
    chainLength: [1, 1],
    tableOffset: false,
  },
  3: {
    difficulty: 3,
    rows: [10, 14],
    cols: [5, 7],
    distractorColumns: [1, 2],
    confusables: true,
    blanks: false,
    chainLength: [1, 2],
    tableOffset: false,
  },
  4: {
    difficulty: 4,
    rows: [12, 18],
    cols: [6, 8],
    distractorColumns: [1, 3],
    confusables: true,
    blanks: true,
    chainLength: [2, 2],
    tableOffset: true,
  },
  5: {
    difficulty: 5,
    rows: [16, 24],
    cols: [7, 9],
    distractorColumns: [2, 4],
    confusables: true,
    blanks: true,
    chainLength: [2, 3],
    tableOffset: true,
  },
};

export const ALL_DIFFICULTIES: ChallengeDifficulty[] = [1, 2, 3, 4, 5];
