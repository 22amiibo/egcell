import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import type { GridCommandId } from "@/domain/commands/commandTypes";
import type { RunEvent } from "@/domain/runs/runTypes";
import { useCommandStats } from "@/hooks/useCommandStats";

/** A minimal, validly-typed event. Mirrors commandMastery.test.ts's own fixture builder. */
function event(atMs: number, command?: GridCommandId): RunEvent {
  return { atMs, action: { kind: "select-cell", cell: { row: 0, col: 0 } }, command };
}

describe("useCommandStats", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("grows the store when a run's events are folded in", () => {
    const { result } = renderHook(() => useCommandStats());

    expect(result.current.stats.MOVE_DOWN).toBeUndefined();

    act(() => {
      result.current.fold([event(0, "MOVE_DOWN"), event(200, "MOVE_DOWN")]);
    });

    expect(result.current.stats.MOVE_DOWN?.uses).toBe(2);
  });

  it("folds a pointer-only event stream — a pointer-origin command still has a command id to key on", () => {
    const { result } = renderHook(() => useCommandStats());

    act(() => {
      result.current.fold([event(0, "CLICK_CELL"), event(150, "CLICK_CELL")]);
    });

    expect(result.current.stats.CLICK_CELL).toMatchObject({ uses: 2 });
  });

  it("accumulates across two folds in the same tick, the second building on the first's result", () => {
    const { result } = renderHook(() => useCommandStats());

    // Both calls go through the *same* `fold` reference captured before either runs — the shape a
    // stale-render-snapshot bug would get wrong: reading `stats` from the hook's own render closure
    // would have both calls compute from the same pre-fold base, and the second call's write would
    // clobber the first's instead of building on it.
    act(() => {
      result.current.fold([event(0, "MOVE_UP")]);
      result.current.fold([event(0, "MOVE_UP")]);
    });

    expect(result.current.stats.MOVE_UP?.uses).toBe(2);
  });

  it("keeps a stable `fold` identity across renders, safe to use as a prop/callback dependency", () => {
    const { result, rerender } = renderHook(() => useCommandStats());
    const firstFold = result.current.fold;

    act(() => {
      result.current.fold([event(0, "MOVE_LEFT")]);
    });
    rerender();

    expect(result.current.fold).toBe(firstFold);
  });
});
