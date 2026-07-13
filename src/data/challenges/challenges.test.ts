import { describe, expect, it } from "vitest";

import { challengeAfter, challenges, defaultChallenge } from "@/data/challenges";
import type { Challenge } from "@/domain/challenges/challengeTypes";
import type { GridActionKind } from "@/domain/grid/gridTypes";
import type { RunState } from "@/domain/runs/runTypes";
import { validateChallenge } from "@/domain/validation/validateChallenge";

function runFor(challenge: Challenge): RunState {
  return {
    challengeId: challenge.id,
    challengeVersion: challenge.version,
    seed: challenge.seed,
    mode: "main-speed",
    status: "running",
    startedAt: 0,
    finishedAt: null,
    elapsedMs: 0,
    events: [],
  };
}

const eachChallenge = challenges.map((challenge) => [challenge.id, challenge] as const);

describe("the challenge registry", () => {
  it("ships every challenge it means to", () => {
    expect(challenges.length).toBeGreaterThan(0);
    expect(challenges).toContain(defaultChallenge);
  });

  it.each(eachChallenge)("%s does not start already complete", (_id, challenge) => {
    // A challenge whose starting grid already satisfies its own validator would finish the instant
    // the player touched anything, at roughly zero elapsed time. It is unplayable, and it is the
    // easiest mistake to make when adding one.
    const result = validateChallenge({
      challenge,
      grid: challenge.initialGrid,
      run: runFor(challenge),
    });

    expect(result.isComplete).toBe(false);
  });

  it.each(eachChallenge)(
    "%s allows the actions its own solution needs",
    (_id, challenge) => {
      const needed: Record<
        Exclude<Challenge["validation"]["kind"], "composite">,
        GridActionKind[]
      > = {
        selection: ["select-cell", "select-range", "select-row", "select-column"],
        navigation: ["select-cell"],
        formatting: ["set-format"],
        "sort-filter": ["sort-column", "filter-column"],
      };

      // A composite must be solvable part by part, so every part's family needs an action.
      const parts =
        challenge.validation.kind === "composite"
          ? challenge.validation.parts
          : [challenge.validation];

      for (const part of parts) {
        expect(
          needed[part.kind].some((action) => challenge.allowedActions.includes(action)),
        ).toBe(true);
      }
    },
  );

  it("gives every challenge a unique id, slug, and seed", () => {
    const ids = challenges.map((challenge) => challenge.id);
    const slugs = challenges.map((challenge) => challenge.slug);
    const seeds = challenges.map((challenge) => challenge.seed);

    expect(new Set(ids).size).toBe(ids.length);
    expect(new Set(slugs).size).toBe(slugs.length);
    expect(new Set(seeds).size).toBe(seeds.length);
  });

  it("gives every challenge a practice note, so practice mode has something to say", () => {
    for (const challenge of challenges) {
      expect(challenge.practiceNotes.length).toBeGreaterThan(0);
    }
  });

  it("keeps the fast route out of the prompt", () => {
    for (const challenge of challenges) {
      expect(challenge.prompt.toLowerCase()).not.toContain("ctrl");
      expect(challenge.prompt.toLowerCase()).not.toContain("shortcut");
    }
  });

  it("covers every family it claims to", () => {
    const families = new Set(challenges.map((challenge) => challenge.family));

    expect(families).toContain("selection");
    expect(families).toContain("navigation");
    expect(families).toContain("formatting");
    expect(families).toContain("sort-filter");
  });
});

describe("challengeAfter", () => {
  it("walks the list in order", () => {
    expect(challengeAfter(challenges[0])).toBe(challenges[1]);
  });

  it("wraps at the end rather than dead-ending", () => {
    expect(challengeAfter(challenges[challenges.length - 1])).toBe(challenges[0]);
  });
});
