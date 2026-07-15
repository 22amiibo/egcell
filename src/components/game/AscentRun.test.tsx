import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AscentRun } from "@/components/game/AscentRun";
import { generatedTemplates } from "@/data/challenges/generated";
import { DATASET_THEMES } from "@/data/datasets/themes";
import { advanceAscent } from "@/domain/ascent/ascentEngine";
import { ASCENT_START, type AscentState } from "@/domain/ascent/ascentTypes";
import { drawAscentTask } from "@/domain/ascent/drawAscentTask";
import type { ChallengeVariant } from "@/domain/challenges/variantTypes";
import type { PersonalRecord } from "@/domain/records/recordTypes";
import type { LocalPersonalRecords } from "@/hooks/useLocalPersonalRecords";
import { solveChallengeDom } from "@/test/solveVariantDom";

/**
 * The seed pins the ladder's draws, so a test can mirror `AscentRun`'s own `drawAscentTask` to know
 * which drill is on screen and solve it — the same technique the sprint tests use against a seeded
 * queue. A long clock keeps the run from ending on time while the ladder itself is under test.
 */
const RUN_SEED = "ascent-component-seed";
const LONG_CLOCK_SECONDS = 3600;

const records: LocalPersonalRecords = {
  records: {},
  getBest: vi.fn(() => undefined),
  submit: vi.fn((candidate: PersonalRecord) => ({
    previousBest: undefined,
    currentBest: candidate,
    isNewRecord: true,
  })),
};

/**
 * A mirror of the component's live draw. `AscentRun` draws each task from the same pure inputs, so
 * reproducing the sequence here yields the exact drill it is showing. `clear` solves that drill and
 * advances the mirror the way `advanceAscent` would, so the next draw stays in lockstep.
 */
function makeClimb() {
  let state: AscentState = ASCENT_START;
  let index = 0;
  let lastTemplateIds: string[] = [];

  function current(): ChallengeVariant {
    const variant = drawAscentTask({
      runSeed: RUN_SEED,
      index,
      tier: state.tier,
      overdriveRungs: state.overdriveRungs,
      lastTemplateIds,
      templates: generatedTemplates,
      themes: DATASET_THEMES,
    });

    if (variant === null) {
      throw new Error(`No Ascent task drawn at index ${index}.`);
    }

    return variant;
  }

  return {
    clear(underTarget: boolean) {
      const variant = current();

      solveChallengeDom(variant);
      state = advanceAscent(state, { completed: true, underTarget });
      lastTemplateIds = [...lastTemplateIds, variant.templateId].slice(-2);
      index += 1;
    },
  };
}

const meter = () => screen.getByRole("status");

describe("AscentRun ladder", () => {
  beforeEach(() => {
    window.localStorage.clear();
    // Freeze the wall clock: a synchronous solve then lands at zero elapsed — comfortably under any
    // target — and a deliberate `setSystemTime` jump is the only way a clear reads as slow.
    vi.useFakeTimers();
    vi.setSystemTime(0);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("promotes a tier after three under-target clears", () => {
    render(<AscentRun runSeed={RUN_SEED} durationSeconds={LONG_CLOCK_SECONDS} records={records} />);

    expect(meter()).toHaveAccessibleName("Tier 1, heat 0 of 3");

    const climb = makeClimb();

    climb.clear(true);
    climb.clear(true);
    expect(meter()).toHaveAccessibleName("Tier 1, heat 2 of 3");

    // The third under-target clear buys the promotion, and heat resets for the next rung.
    climb.clear(true);
    expect(meter()).toHaveAccessibleName("Tier 2, heat 0 of 3");
  });

  it("resets heat on a slow clear but never drops the tier", () => {
    render(<AscentRun runSeed={RUN_SEED} durationSeconds={LONG_CLOCK_SECONDS} records={records} />);

    const climb = makeClimb();

    // Climb to tier 2 (three unders), then bank two more toward the next rung.
    climb.clear(true);
    climb.clear(true);
    climb.clear(true);
    climb.clear(true);
    climb.clear(true);
    expect(meter()).toHaveAccessibleName("Tier 2, heat 2 of 3");

    // A slow clear: elapsed jumps well past the drill's target, so it grades as over target.
    vi.setSystemTime(120_000);
    climb.clear(false);

    // Heat is back to zero and the tier held at 2 — a slow clear costs heat, never a rung earned.
    expect(meter()).toHaveAccessibleName("Tier 2, heat 0 of 3");
  });

  it("never ends the run early — only the clock ends a climb", () => {
    render(<AscentRun runSeed={RUN_SEED} durationSeconds={LONG_CLOCK_SECONDS} records={records} />);

    // Skipping is not a fail state: no number of skips ends the climb before the clock does.
    for (let skip = 0; skip < 6; skip += 1) {
      fireEvent.click(screen.getByRole("button", { name: "Skip task" }));
    }

    expect(screen.queryByTestId("ascent-result-card")).not.toBeInTheDocument();
    expect(meter()).toHaveAccessibleName("Tier 1, heat 0 of 3");
  });
});
