import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { selectionRevenueColumnChallenge } from "@/data/challenges";
import { createRevenueGrid, REVENUE_COL } from "@/data/grids/revenueGrid";
import type { Challenge } from "@/domain/challenges/challengeTypes";
import type { ActionMeta } from "@/domain/commands/commandTypes";
import type { CellAddress } from "@/domain/grid/gridTypes";
import type { PersonalRecord } from "@/domain/records/recordTypes";
import { useGameRun, type FinishedRun, type GameRunOptions } from "@/hooks/useGameRun";
import type { LocalPersonalRecords } from "@/hooks/useLocalPersonalRecords";

/** One action completes this challenge: selecting the Revenue column is the whole drill. */
const challenge = selectionRevenueColumnChallenge;

const SELECT_REVENUE_COLUMN: ActionMeta = {
  command: "SELECT_COLUMN",
  inputMethod: "keyboard",
  via: "shortcut",
  chord: "mod+Space",
  controlId: null,
};

function records(): LocalPersonalRecords {
  return {
    records: {},
    getBest: vi.fn(() => undefined),
    submit: vi.fn((candidate: PersonalRecord) => ({
      previousBest: undefined,
      currentBest: candidate,
      isNewRecord: true,
    })),
  };
}

/**
 * Mounts a fresh run and drives its one completing action. The clock is frozen (fake timers), so
 * every run finishes at exactly zero elapsed time and identical options mean identical scores —
 * which is what lets tests compare two runs' scores as pure numbers.
 */
function completeRun(options: GameRunOptions = {}): FinishedRun {
  const view = renderHook(() =>
    useGameRun(challenge, "main-speed", records(), { recordPersonalBest: false, ...options }),
  );

  act(() => {
    view.result.current.dispatch(
      { kind: "select-column", col: REVENUE_COL, usedRangeOnly: true },
      SELECT_REVENUE_COLUMN,
    );
  });

  const finished = view.result.current.result;

  expect(finished).not.toBeNull();

  return finished!;
}

/** A9, just past the fixed Revenue dataset's used range — free for a player to write into. */
const CELL_VALUE_TARGET: CellAddress = { row: 8, col: 0 };

/** A challenge a single `set-cell-value` commit completes, mirroring validateValue.test.ts's stub. */
const cellValueChallenge: Challenge = {
  id: "test.keystroke-accuracy",
  version: "v1",
  slug: "test-keystroke-accuracy",
  title: "Test keystroke accuracy",
  prompt: "Write the value into A9.",
  family: "formula",
  difficulty: 1,
  seed: "test-keystroke-accuracy-v1",
  timingPolicy: { kind: "single-challenge", targetSeconds: 10 },
  initialGrid: createRevenueGrid(),
  allowedActions: ["select-cell", "set-cell-value"],
  validation: { kind: "cell-value", cell: CELL_VALUE_TARGET, expected: { kind: "number", value: 42 } },
  scoring: { basePoints: 100, targetSeconds: 10, minimumCorrectnessForPr: 1 },
  practiceNotes: [],
};

/**
 * Mounts a fresh run against `cellValueChallenge` and drives its one completing action: a
 * `COMMIT_EDIT`-shaped `set-cell-value` whose committed value satisfies the validator and whose
 * meta carries the keystroke evidence the caller wants graded.
 */
function completeCellValueRun(keystrokes: { chars: number; corrections: number }): FinishedRun {
  const view = renderHook(() =>
    useGameRun(cellValueChallenge, "main-speed", records(), { recordPersonalBest: false }),
  );

  const commitEdit: ActionMeta = {
    command: "COMMIT_EDIT",
    inputMethod: "keyboard",
    via: "grid",
    chord: null,
    controlId: null,
    keystrokes,
  };

  act(() => {
    view.result.current.dispatch(
      { kind: "set-cell-value", cell: CELL_VALUE_TARGET, value: { kind: "number", value: 42 } },
      commitEdit,
    );
  });

  const finished = view.result.current.result;

  expect(finished).not.toBeNull();

  return finished!;
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("useGameRun getComboMultiplier", () => {
  it("scores the run with the multiplier the callback reports at finish time", () => {
    const plain = completeRun();
    const withCombo = completeRun({ getComboMultiplier: () => 1.5 });

    expect(plain.score.comboMultiplier).toBe(1);
    expect(withCombo.score.comboMultiplier).toBe(1.5);

    // Exactly 1.5x. Under the frozen clock both runs sit at the speed cap, so the only difference
    // between the two raw scores is the combo factor and the rounding cannot drift.
    expect(plain.score.score).toBeGreaterThan(0);
    expect(withCombo.score.score).toBe(Math.round(plain.score.score * 1.5));
  });
});

describe("useGameRun keystroke tracking", () => {
  it("carries keystroke counts from meta through to the event log", () => {
    const view = renderHook(() =>
      useGameRun(challenge, "main-speed", records(), { recordPersonalBest: false }),
    );

    const keystrokesMeta: ActionMeta = {
      ...SELECT_REVENUE_COLUMN,
      keystrokes: { chars: 5, corrections: 1 },
    };

    act(() => {
      view.result.current.dispatch(
        { kind: "select-column", col: REVENUE_COL, usedRangeOnly: true },
        keystrokesMeta,
      );
    });

    const lastEvent = view.result.current.events.at(-1);
    expect(lastEvent?.keystrokes).toEqual({ chars: 5, corrections: 1 });
  });
});

describe("useGameRun keystroke accuracy", () => {
  it("a typing run's accuracy can finally be a value other than 1", () => {
    const finished = completeCellValueRun({ chars: 6, corrections: 1 });

    // The milestone: a run whose completing action typed and corrected is graded on that typing,
    // not waved through at the validator's flat 1 — for both the number the player reads and the
    // multiplier that number feeds into.
    expect(finished.accuracy).toBeCloseTo(5 / 6);
    expect(finished.score.accuracyMultiplier).toBeLessThan(1);
  });

  it("falls back to the validator's accuracy when nothing in the run carries keystrokes", () => {
    // `completeRun` drives a column selection: no event carries a `keystrokes` field, so
    // `keystrokeAccuracy` is null and `buildFinished` must fall back to `validation.accuracy`.
    const finished = completeRun();

    expect(finished.accuracy).toBe(finished.validation.accuracy);
  });
});
