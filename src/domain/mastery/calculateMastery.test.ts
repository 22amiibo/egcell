import { describe, expect, it } from "vitest";

import { calculateMastery } from "@/domain/mastery/calculateMastery";

describe("mastery projection", () => {
  it("recommends the weakest practiced family", () => {
    expect(
      calculateMastery([
        { family: "selection", score: 900, accuracy: 1, shortcutEfficiency: 90 },
      ]),
    ).toMatchObject({
      recommendedFamily: "selection",
    });
  });

  it("keeps every professional skill family visible and unpracticed ones new", () => {
    const mastery = calculateMastery([]);

    expect(mastery.skills.map((skill) => skill.label)).toEqual([
      "Navigation",
      "Selection",
      "Formatting",
      "Formulas",
      "Sort / Filter",
      "Fill / Paste",
      "Tables",
      "Mixed Workflows",
    ]);
    expect(mastery.skills.every((skill) => skill.level === "new")).toBe(true);
    expect(mastery.recommendedFamily).toBe("navigation");
  });

  it("advances levels from clean, efficient, high-scoring practice", () => {
    const mastery = calculateMastery(
      Array.from({ length: 8 }, () => ({
        family: "formatting" as const,
        score: 1900,
        accuracy: 1,
        shortcutEfficiency: 100,
      })),
    );
    const formatting = mastery.skills.find((skill) => skill.family === "formatting");

    expect(formatting).toMatchObject({ level: "elite", runCount: 8 });
    expect(mastery.badges).toContain("Clean operator");
    expect(mastery.unlockSignals).toContain("precision-accent");
  });
});
