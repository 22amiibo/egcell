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
import {
  ascentRecordKey,
  isNewAscentRecord,
  updateAscentRecords,
  type AscentRecord,
  type AscentRecordStore,
} from "@/domain/records/ascentRecords";
import type { LocalAscentRecords } from "@/hooks/useLocalAscentRecords";
import type { LocalPersonalRecords } from "@/hooks/useLocalPersonalRecords";
import { formatScore } from "@/lib/format";
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
 * A faithful, in-memory `LocalAscentRecords`: the same comparison rules the real hook submits
 * through (`updateAscentRecords`/`isNewAscentRecord`), without the localStorage/React plumbing —
 * so a banking test proves out against the book's own winner logic, not a stub's guess at it.
 * `submit` is wrapped in `vi.fn` so a test can assert it was called exactly once, same as a spy.
 */
function makeAscentRecordsStore(): LocalAscentRecords {
  let store: AscentRecordStore = {};

  const submit = vi.fn((candidate: AscentRecord) => {
    const key = ascentRecordKey(candidate.durationSeconds);
    const previousBest = store[key];

    store = updateAscentRecords(store, candidate);

    return {
      previousBest,
      currentBest: store[key] as AscentRecord,
      isNewRecord: isNewAscentRecord(previousBest, candidate),
    };
  });

  return {
    get records() {
      return store;
    },
    getBest: (durationSeconds: number) => store[ascentRecordKey(durationSeconds)],
    submit,
  };
}

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
    render(
      <AscentRun
        runSeed={RUN_SEED}
        durationSeconds={LONG_CLOCK_SECONDS}
        records={records}
        ascentRecords={makeAscentRecordsStore()}
      />,
    );

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
    render(
      <AscentRun
        runSeed={RUN_SEED}
        durationSeconds={LONG_CLOCK_SECONDS}
        records={records}
        ascentRecords={makeAscentRecordsStore()}
      />,
    );

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
    render(
      <AscentRun
        runSeed={RUN_SEED}
        durationSeconds={LONG_CLOCK_SECONDS}
        records={records}
        ascentRecords={makeAscentRecordsStore()}
      />,
    );

    // Skipping is not a fail state: no number of skips ends the climb before the clock does.
    for (let skip = 0; skip < 6; skip += 1) {
      fireEvent.click(screen.getByRole("button", { name: "Skip task" }));
    }

    expect(screen.queryByTestId("ascent-result-card")).not.toBeInTheDocument();
    expect(meter()).toHaveAccessibleName("Tier 1, heat 0 of 3");
  });
});

/**
 * A clock short enough that a system-time jump mid-test crosses the deadline, ending the climb
 * without needing to fast-forward through the pending per-task `setTimeout` — the same trick
 * `climb.clear(false)` above uses to force an over-target grade.
 */
const SHORT_CLOCK_SECONDS = 5;

describe("AscentRun banking", () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.useFakeTimers();
    vi.setSystemTime(0);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("banks the record and appends the run log exactly once when the climb ends", () => {
    const ascentRecords = makeAscentRecordsStore();
    const recordHistory = vi.fn();

    const { rerender } = render(
      <AscentRun
        runSeed={RUN_SEED}
        durationSeconds={SHORT_CLOCK_SECONDS}
        records={records}
        ascentRecords={ascentRecords}
        recordHistory={recordHistory}
      />,
    );

    const climb = makeClimb();

    // A clear well inside the deadline keeps the climb going...
    climb.clear(true);
    expect(screen.queryByTestId("ascent-result-card")).not.toBeInTheDocument();

    // ...and a second clear landing after it ends the climb at exactly two tasks.
    vi.setSystemTime(6000);
    climb.clear(true);

    expect(screen.getByTestId("ascent-result-card")).toBeVisible();
    expect(screen.getByTestId("ascent-tasks")).toHaveTextContent("2 tasks");

    // The book banked this, the only run so far, as a first-ever record...
    expect(ascentRecords.submit).toHaveBeenCalledTimes(1);
    expect(ascentRecords.getBest(SHORT_CLOCK_SECONDS)).toBeDefined();
    expect(screen.getByTestId("pr-badge")).toBeVisible();

    // ...and the run log heard about it exactly once, shaped like an Ascent climb.
    expect(recordHistory).toHaveBeenCalledTimes(1);
    expect(recordHistory).toHaveBeenCalledWith(
      expect.objectContaining({
        modeKey: "ascent",
        tasksCompleted: 2,
        taskCount: 2,
        isNewRecord: true,
      }),
    );

    // A re-render after the climb already ended (a parent re-rendering for an unrelated reason)
    // must not submit the same climb twice.
    rerender(
      <AscentRun
        runSeed={RUN_SEED}
        durationSeconds={SHORT_CLOCK_SECONDS}
        records={records}
        ascentRecords={ascentRecords}
        recordHistory={recordHistory}
      />,
    );

    expect(ascentRecords.submit).toHaveBeenCalledTimes(1);
    expect(recordHistory).toHaveBeenCalledTimes(1);
  });

  it("keeps the book's best when a retried run scores lower, and shows this run's own peak", () => {
    const ascentRecords = makeAscentRecordsStore();
    // Retry always draws a fresh climb; pinning it to the same seed keeps `makeClimb` a valid
    // mirror across the retry, exactly as the seeded-queue sprint tests pin a session's re-race.
    const pinnedSeed = () => RUN_SEED;

    render(
      <AscentRun
        runSeed={RUN_SEED}
        durationSeconds={SHORT_CLOCK_SECONDS}
        records={records}
        ascentRecords={ascentRecords}
        createSessionSeed={pinnedSeed}
      />,
    );

    // Run 1: two clean, instant clears — the stronger run, and the one that should win the book.
    const firstClimb = makeClimb();

    firstClimb.clear(true);
    vi.setSystemTime(6000);
    firstClimb.clear(true);

    expect(screen.getByTestId("ascent-tasks")).toHaveTextContent("2 tasks");

    const bestAfterRun1 = ascentRecords.getBest(SHORT_CLOCK_SECONDS);

    if (bestAfterRun1 === undefined) {
      throw new Error("Expected run 1 to have banked a record.");
    }

    // Retry, back at time zero so the next climb's own clock starts fresh.
    vi.setSystemTime(0);
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));

    // Run 2: one clear landing well past its own deadline — fewer tasks *and* far slower than run
    // 1's instant first clear, so it cannot outscore run 1 on either lever the book compares.
    vi.setSystemTime(6000);
    const secondClimb = makeClimb();

    secondClimb.clear(false);

    expect(screen.getByTestId("ascent-tasks")).toHaveTextContent("1 task");

    // The book did not move...
    expect(ascentRecords.getBest(SHORT_CLOCK_SECONDS)).toEqual(bestAfterRun1);
    // ...and the card in front of the player honestly shows this (losing) run's own numbers, not
    // the incumbent's, with no badge for a record that was not actually beaten.
    expect(screen.queryByTestId("pr-badge")).not.toBeInTheDocument();
    expect(screen.getByTestId("ascent-pr-line")).toHaveTextContent(
      formatScore(bestAfterRun1.bestScore),
    );
  });

  it("reports neither wpm nor accuracy for a climb that only ever skipped", () => {
    const ascentRecords = makeAscentRecordsStore();

    render(
      <AscentRun
        runSeed={RUN_SEED}
        durationSeconds={SHORT_CLOCK_SECONDS}
        records={records}
        ascentRecords={ascentRecords}
      />,
    );

    // Two skips with no grid interaction at all before either: nothing was ever typed.
    fireEvent.click(screen.getByRole("button", { name: "Skip task" }));
    vi.setSystemTime(6000);
    fireEvent.click(screen.getByRole("button", { name: "Skip task" }));

    expect(screen.getByTestId("ascent-result-card")).toBeVisible();
    expect(screen.queryByText("WPM")).not.toBeInTheDocument();
    expect(screen.queryByText("Accuracy")).not.toBeInTheDocument();
  });
});
