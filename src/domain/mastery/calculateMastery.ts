import type {
  MasteryLevel,
  MasteryProjection,
  MasteryRun,
  SkillFamily,
  SkillMastery,
} from "@/domain/mastery/masteryTypes";

export const SKILL_FAMILIES: ReadonlyArray<{ family: SkillFamily; label: string }> = [
  { family: "navigation", label: "Navigation" },
  { family: "selection", label: "Selection" },
  { family: "formatting", label: "Formatting" },
  { family: "formulas", label: "Formulas" },
  { family: "sort-filter", label: "Sort / Filter" },
  { family: "fill-paste", label: "Fill / Paste" },
  { family: "tables", label: "Tables" },
  { family: "mixed", label: "Mixed Workflows" },
];

const clampPercent = (value: number): number => {
  if (!Number.isFinite(value)) {
    return 0;
  }

  const percent = value <= 1 ? value * 100 : value;

  return Math.min(100, Math.max(0, percent));
};

function levelFor(score: number, runCount: number): MasteryLevel {
  if (runCount === 0) {
    return "new";
  }

  if (score < 55) {
    return "steady";
  }

  if (score < 70) {
    return "fast";
  }

  if (score < 85) {
    return "sharp";
  }

  return "elite";
}

function skillProjection(family: SkillFamily, label: string, runs: MasteryRun[]): SkillMastery {
  const familyRuns = runs.filter((run) => run.family === family);

  if (familyRuns.length === 0) {
    return { family, label, level: "new", score: 0, runCount: 0 };
  }

  const averagePerformance =
    familyRuns.reduce((sum, run) => {
      const scorePercent = Math.min(100, Math.max(0, run.score / 20));

      return (
        sum +
        scorePercent * 0.5 +
        clampPercent(run.accuracy) * 0.3 +
        clampPercent(run.shortcutEfficiency) * 0.2
      );
    }, 0) / familyRuns.length;
  const score = Math.round(Math.min(100, averagePerformance + Math.min(familyRuns.length * 3, 12)));

  return {
    family,
    label,
    level: levelFor(score, familyRuns.length),
    score,
    runCount: familyRuns.length,
  };
}

/** Pure, local-only projection. It ranks the player's own practiced skills, never other people. */
export function calculateMastery(runs: MasteryRun[]): MasteryProjection {
  const skills = SKILL_FAMILIES.map(({ family, label }) =>
    skillProjection(family, label, runs),
  );
  const practiced = skills.filter((skill) => skill.runCount > 0);
  const recommendedFamily =
    practiced.reduce<SkillMastery | null>(
      (weakest, skill) =>
        weakest === null || skill.score < weakest.score ? skill : weakest,
      null,
    )?.family ?? SKILL_FAMILIES[0].family;
  const accuracies = runs.map((run) => clampPercent(run.accuracy));
  const shortcuts = runs.map((run) => clampPercent(run.shortcutEfficiency));
  const badges: string[] = [];
  const unlockSignals: string[] = [];

  if (accuracies.some((accuracy) => accuracy >= 100)) {
    badges.push("Clean operator");
  }

  if (shortcuts.some((efficiency) => efficiency >= 90)) {
    badges.push("Keyboard route");
  }

  if (runs.length >= 5 && accuracies.reduce((sum, value) => sum + value, 0) / runs.length >= 98) {
    unlockSignals.push("precision-accent");
  }

  if (skills.some((skill) => skill.level === "elite")) {
    unlockSignals.push("elite-gridline");
  }

  return { skills, recommendedFamily, badges, unlockSignals };
}
