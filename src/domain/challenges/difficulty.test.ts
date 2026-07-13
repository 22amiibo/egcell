import { describe, expect, it } from "vitest";

import { ALL_DIFFICULTIES, DIFFICULTY_PRESETS } from "@/domain/challenges/difficulty";

describe("difficulty presets", () => {
  it("defines a preset for every difficulty, keyed by itself", () => {
    for (const difficulty of ALL_DIFFICULTIES) {
      expect(DIFFICULTY_PRESETS[difficulty].difficulty).toBe(difficulty);
    }
  });

  it("keeps every band ordered min to max", () => {
    for (const difficulty of ALL_DIFFICULTIES) {
      const preset = DIFFICULTY_PRESETS[difficulty];

      expect(preset.rows[0]).toBeLessThanOrEqual(preset.rows[1]);
      expect(preset.cols[0]).toBeLessThanOrEqual(preset.cols[1]);
      expect(preset.distractorColumns[0]).toBeLessThanOrEqual(preset.distractorColumns[1]);
      expect(preset.chainLength[0]).toBeLessThanOrEqual(preset.chainLength[1]);
      expect(preset.chainLength[0]).toBeGreaterThanOrEqual(1);
    }
  });

  it("grows the work as difficulty rises", () => {
    for (let step = 1; step < ALL_DIFFICULTIES.length; step += 1) {
      const easier = DIFFICULTY_PRESETS[ALL_DIFFICULTIES[step - 1]];
      const harder = DIFFICULTY_PRESETS[ALL_DIFFICULTIES[step]];

      expect(harder.rows[0]).toBeGreaterThanOrEqual(easier.rows[0]);
      expect(harder.cols[0]).toBeGreaterThanOrEqual(easier.cols[0]);
    }
  });

  it("leaves room for distractors inside the column budget", () => {
    // Templates need a few real roles even after distractors take their columns.
    for (const difficulty of ALL_DIFFICULTIES) {
      const preset = DIFFICULTY_PRESETS[difficulty];

      expect(preset.cols[1] - preset.distractorColumns[1]).toBeGreaterThanOrEqual(4);
    }
  });
});
