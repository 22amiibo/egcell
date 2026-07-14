import { renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { challenges } from "@/data/challenges";
import { useFastestPath } from "@/hooks/useFastestPath";

const getRoutes = vi.hoisted(() => vi.fn());

vi.mock("@/domain/routes/routeCache", () => ({ getRoutes }));

afterEach(() => {
  getRoutes.mockReset();
});

describe("useFastestPath", () => {
  it("does not run the solver while the run is live", () => {
    // The latency guarantee, and the reason `enabled` is a parameter rather than a convention the
    // next caller has to remember: the search costs up to half a second on the deepest drills, and a
    // player who paid that on a keystroke would feel the grid stutter under their hands (§6.3).
    const { result } = renderHook(() => useFastestPath(challenges[0], [], false));

    expect(getRoutes).not.toHaveBeenCalled();
    expect(result.current).toBeNull();
  });

  it("runs it once the run is over — and only once", () => {
    getRoutes.mockReturnValue(null);

    const events: never[] = [];
    const { rerender, result } = renderHook(
      ({ enabled }) => useFastestPath(challenges[0], events, enabled),
      { initialProps: { enabled: true } },
    );

    expect(getRoutes).toHaveBeenCalledTimes(1);
    expect(getRoutes).toHaveBeenCalledWith(challenges[0]);
    expect(result.current?.routes).toBeNull();

    rerender({ enabled: true });

    // A re-render is not a new question. The card re-renders on every route toggle, and paying for a
    // fresh search each time is precisely the stutter this hook exists to prevent.
    expect(getRoutes).toHaveBeenCalledTimes(1);
  });
});
