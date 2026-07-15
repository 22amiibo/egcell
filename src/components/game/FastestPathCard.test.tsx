import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { FastestPathCard } from "@/components/game/FastestPathCard";
import { challenges } from "@/data/challenges";
import { nextFocusAnchor, resolveCommand } from "@/domain/commands/resolveCommand";
import { gridReducer } from "@/domain/grid/gridReducer";
import type { CellAddress, GridAction } from "@/domain/grid/gridTypes";
import type { RouteComparison } from "@/domain/routes/compareRoute";
import { getRoutes } from "@/domain/routes/routeCache";
import type { Route } from "@/domain/routes/routeTypes";
import { SYNTHETIC_RUN } from "@/domain/routes/solveRoute";
import { validateChallenge } from "@/domain/validation/validateChallenge";
import type { FastestPath } from "@/hooks/useFastestPath";

const comparison: RouteComparison = {
  optimalActions: 2,
  playerActions: 5,
  extraActions: 3,
  efficiency: 0.4,
  keyboardActions: 5,
  pointerActions: 0,
  shortcutActions: 5,
  keyboardShare: 1,
  shortcutShare: 1,
  matchedRouteId: null,
  missedShortcuts: [
    {
      kind: "repeated-step",
      observed: "4 × Move down one cell",
      suggested: "JUMP_DOWN",
      suggestedChordLabel: "Ctrl + ↓",
      savedActions: 3,
    },
  ],
  confidence: "high",
};

function route(id: string, overrides: Partial<Route> = {}): Route {
  return {
    id,
    label: "Keyboard route",
    kind: "keyboard",
    steps: [
      { command: "JUMP_DOWN", label: "Jump to the bottom", cost: 1 },
      { command: "TOGGLE_BOLD", label: "Bold", cost: 1 },
    ],
    optimalActions: 2,
    optimalCost: 2,
    keyboardComplete: true,
    source: "solver",
    version: "v1",
    nearOptimal: false,
    ...overrides,
  };
}

function path(overrides: Partial<FastestPath> = {}): FastestPath {
  return { routes: [route("route-a")], comparison, platform: "windows", ...overrides };
}

describe("FastestPathCard", () => {
  it("shows the steps with this platform's chords, and the comparison", () => {
    render(<FastestPathCard path={path()} />);

    const steps = screen.getByTestId("fastest-path-steps");

    expect(steps).toHaveTextContent("Jump to the bottom of the data");
    expect(steps).toHaveTextContent("Ctrl + ↓");
    expect(screen.getByText("Optimal actions").nextSibling).toHaveTextContent("2");
    expect(screen.getByText("Your actions").nextSibling).toHaveTextContent("5");
    expect(screen.getByText("Extra actions").nextSibling).toHaveTextContent("3");
    expect(screen.getByText("Efficiency").nextSibling).toHaveTextContent("40%");
  });

  it("says a menu-driven step is still a keyboard step, and how to reach it", () => {
    // SORT_DESC has no chord of its own: it lives in the filter menu, which Alt+↓ opens. Leaving the
    // step blank would tell a keyboard player to reach for the mouse, which is exactly false.
    render(
      <FastestPathCard
        path={path({
          routes: [route("route-a", { steps: [{ command: "SORT_DESC", label: "Sort", cost: 1 }] })],
        })}
      />,
    );

    expect(screen.getByTestId("fastest-path-steps")).toHaveTextContent("Alt + ↓, then choose");
  });

  it("names the missed shortcut and what it would have saved", () => {
    render(<FastestPathCard path={path()} />);

    const missed = screen.getByTestId("missed-shortcuts");

    expect(missed).toHaveTextContent("4 × Move down one cell");
    expect(missed).toHaveTextContent("saves 3 actions");
  });

  it("offers both routes when two tie, and switches between them", async () => {
    const user = userEvent.setup();
    const second = route("route-b", {
      steps: [
        { command: "JUMP_RIGHT", label: "Jump right", cost: 1 },
        { command: "TOGGLE_BOLD", label: "Bold", cost: 1 },
      ],
    });

    render(<FastestPathCard path={path({ routes: [route("route-a"), second] })} />);

    expect(screen.getByTestId("fastest-path-steps")).toHaveTextContent("Jump to the bottom");

    await user.click(screen.getByRole("button", { name: "Route B" }));

    expect(screen.getByTestId("fastest-path-steps")).toHaveTextContent("Jump to the right edge");
  });

  it("calls a composite's route a fast path, never the fastest one", () => {
    // A composite's parts were solved one at a time, so a better interleaving may exist.
    // `nearOptimal` is the flag, and this sentence is what it buys: the card never claims more than
    // the solver actually proved.
    render(<FastestPathCard path={path({ routes: [route("route-a", { nearOptimal: true })] })} />);

    expect(screen.getByRole("heading", { name: "A fast path" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Fastest path" })).not.toBeInTheDocument();
  });

  it("admits when there is no route rather than inventing one", () => {
    render(<FastestPathCard path={path({ routes: null })} />);

    expect(screen.getByTestId("fastest-path")).toHaveTextContent(
      "No fastest path is recorded for this drill yet.",
    );
    expect(screen.queryByText("Optimal actions")).not.toBeInTheDocument();
  });

  it("drops the comparison, not the honesty, when the events carried no commands", () => {
    render(
      <FastestPathCard
        path={path({ comparison: { ...comparison, confidence: "low", missedShortcuts: [] } })}
      />,
    );

    expect(screen.getByTestId("fastest-path")).toHaveTextContent(
      "recorded 5 actions but not what produced them",
    );
    expect(screen.queryByText("Efficiency")).not.toBeInTheDocument();
    expect(screen.queryByTestId("missed-shortcuts")).not.toBeInTheDocument();
  });

  it("shows a route that actually solves the challenge: the card's own steps, replayed", () => {
    // The end-to-end claim, made against the real thing. Take a shipped challenge, render the card
    // the app would render for it, check the steps the player is reading, and press those same
    // commands through the real reducer. If what the card shows does not solve the drill, this fails.
    const challenge = challenges[1];
    const routes = getRoutes(challenge);

    expect(routes).not.toBeNull();

    render(<FastestPathCard path={{ routes, comparison, platform: "windows" }} />);

    const rendered = screen.getByTestId("fastest-path-steps").textContent ?? "";
    let grid = challenge.initialGrid;
    let focus: CellAddress = grid.activeCell;
    let anchor: CellAddress = grid.activeCell;

    for (const step of (routes as Route[])[0].steps) {
      expect(rendered).toContain(step.label);

      const action = resolveCommand(step.command, { grid, focus, anchor, editBuffer: null });
      const ends = nextFocusAnchor(action as GridAction, focus, { focus, anchor });

      grid = gridReducer(grid, action as GridAction);
      focus = ends.focus;
      anchor = ends.anchor;
    }

    expect(validateChallenge({ challenge, grid, run: SYNTHETIC_RUN }).isComplete).toBe(true);
  });
});
