export type SkillFamily =
  | "navigation"
  | "selection"
  | "formatting"
  | "formulas"
  | "sort-filter"
  | "fill-paste"
  | "tables"
  | "mixed";

export type MasteryLevel = "new" | "steady" | "fast" | "sharp" | "elite";

export type MasteryRun = {
  family: SkillFamily;
  score: number;
  /** Accepts either the validator's 0-1 fraction or a display-ready 0-100 percentage. */
  accuracy: number;
  /** Accepts either a 0-1 fraction or a display-ready 0-100 percentage. */
  shortcutEfficiency: number;
};

export type SkillMastery = {
  family: SkillFamily;
  label: string;
  level: MasteryLevel;
  score: number;
  runCount: number;
};

export type MasteryProjection = {
  skills: SkillMastery[];
  recommendedFamily: SkillFamily;
  badges: string[];
  /** Stable ids that settings can later map to cosmetic choices. */
  unlockSignals: string[];
};
