import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { selectionRevenueColumnChallenge } from "@/data/challenges";
import { REVENUE_COL } from "@/data/grids/revenueGrid";
import type { ActionMeta } from "@/domain/commands/commandTypes";
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
