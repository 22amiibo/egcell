import { describe, expect, it } from "vitest";

import type { GridCommandId } from "@/domain/commands/commandTypes";
import { commandStream, compareRoute } from "@/domain/routes/compareRoute";
import type { Route } from "@/domain/routes/routeTypes";
import type { RunEvent } from "@/domain/runs/runTypes";

function event(command: GridCommandId, overrides: Partial<RunEvent> = {}): RunEvent {
  return {
    atMs: 0,
    action: { kind: "select-cell", cell: { row: 0, col: 0 } },
    inputMethod: "keyboard",
    via: "shortcut",
    command,
    chord: null,
    controlId: null,
    ...overrides,
  };
}

function route(commands: GridCommandId[], overrides: Partial<Route> = {}): Route {
  return {
    id: "route-a",
    label: "Keyboard route",
    kind: "keyboard",
    steps: commands.map((command) => ({ command, label: command, cost: 1 })),
    optimalActions: commands.length,
    optimalCost: commands.length,
    keyboardComplete: true,
    source: "solver",
    version: "v1",
    nearOptimal: false,
    ...overrides,
  };
}

describe("commandStream", () => {
  it("collapses one drag gesture into one action", () => {
    // A drag fires a select-range per pointer move. Counting one gesture as three actions would
    // invent an inefficiency the player never committed — and then coach them about it.
    const stream = commandStream([
      event("CLICK_CELL"),
      event("DRAG_SELECT_RANGE", { inputMethod: "pointer", via: "grid" }),
      event("DRAG_SELECT_RANGE", { inputMethod: "pointer", via: "grid" }),
      event("DRAG_SELECT_RANGE", { inputMethod: "pointer", via: "grid" }),
      event("TOGGLE_BOLD"),
    ]);

    expect(stream.map((action) => action.command)).toEqual([
      "CLICK_CELL",
      "DRAG_SELECT_RANGE",
      "TOGGLE_BOLD",
    ]);
  });

  it("counts a held arrow key as the moves it actually made", () => {
    // Auto-repeat is indistinguishable from repeated presses at the DOM level, and it should be:
    // four grid moves happened, and the count must not pretend otherwise (§6.6).
    const stream = commandStream([
      event("MOVE_DOWN"),
      event("MOVE_DOWN"),
      event("MOVE_DOWN"),
      event("MOVE_DOWN"),
    ]);

    expect(stream).toHaveLength(4);
  });
});

describe("compareRoute", () => {
  it("reports the brief's example: optimal 5, yours 8, extra 3", () => {
    const events = [
      ...Array.from({ length: 4 }, () => event("MOVE_DOWN")),
      event("JUMP_RIGHT"),
      event("SELECT_COLUMN"),
      event("TOGGLE_BOLD"),
      event("MOVE_UP"),
    ];
    const comparison = compareRoute(
      events,
      [route(["JUMP_DOWN", "JUMP_RIGHT", "SELECT_COLUMN", "TOGGLE_BOLD", "MOVE_UP"])],
      "windows",
    );

    expect(comparison.optimalActions).toBe(5);
    expect(comparison.playerActions).toBe(8);
    expect(comparison.extraActions).toBe(3);
    expect(Math.round(comparison.efficiency * 100)).toBe(63);
  });

  it("credits a player who walked a shortest route — even the other one", () => {
    // The solver returns every route tied for shortest. A player who found the second one walked an
    // optimal route, and telling them otherwise would be a lie the tie itself refutes.
    const routes = [
      route(["JUMP_DOWN", "JUMP_RIGHT"], { id: "route-a" }),
      route(["JUMP_RIGHT", "JUMP_DOWN"], { id: "route-b" }),
    ];
    const comparison = compareRoute([event("JUMP_RIGHT"), event("JUMP_DOWN")], routes, "windows");

    expect(comparison.matchedRouteId).toBe("route-b");
    expect(comparison.efficiency).toBe(1);
    expect(comparison.extraActions).toBe(0);
  });

  it("forgives the order of a composite's parts, which may be done either way round", () => {
    const grouped = route(["SORT_DESC", "SELECT_ROW", "TOGGLE_BOLD"], {
      steps: [
        { command: "SORT_DESC", label: "Sort", cost: 1, group: "part-1" },
        { command: "SELECT_ROW", label: "Select the row", cost: 1, group: "part-2" },
        { command: "TOGGLE_BOLD", label: "Bold", cost: 1, group: "part-2" },
      ],
    });
    const comparison = compareRoute(
      [event("SELECT_ROW"), event("TOGGLE_BOLD"), event("SORT_DESC")],
      [grouped],
      "windows",
    );

    expect(comparison.matchedRouteId).toBe("route-a");
  });

  describe("missed shortcuts", () => {
    it("names the jump that would have replaced a run of arrows, and what it saves", () => {
      const events = [
        event("MOVE_DOWN"),
        event("MOVE_DOWN"),
        event("MOVE_DOWN"),
        event("MOVE_DOWN"),
      ];
      const comparison = compareRoute(events, [route(["JUMP_DOWN"])], "windows");
      const [missed] = comparison.missedShortcuts;

      expect(missed.kind).toBe("repeated-step");
      expect(missed.suggested).toBe("JUMP_DOWN");
      expect(missed.savedActions).toBe(3);
      expect(missed.suggestedChordLabel).toContain("Ctrl");
    });

    it("stays quiet about a jump the fastest route never uses", () => {
      // The shortcut exists, and pressing it here would land somewhere else entirely. Coaching a
      // player to use a jump that does not solve *this* drill is the hand-authored practice note's
      // mistake (§10.1) in a new hat — so the detector asks the route before it opens its mouth.
      const events = [event("MOVE_DOWN"), event("MOVE_DOWN"), event("MOVE_DOWN")];
      const comparison = compareRoute(events, [route(["MOVE_DOWN", "MOVE_DOWN"])], "windows");

      expect(comparison.missedShortcuts).toEqual([]);
    });

    it("tells a toolbar user the chord, and credits it with saving nothing — because it saves nothing", () => {
      const comparison = compareRoute(
        [
          event("TOGGLE_BOLD", {
            inputMethod: "pointer",
            via: "toolbar",
            controlId: "toolbar-bold",
          }),
        ],
        [route(["TOGGLE_BOLD"])],
        "mac",
      );
      const [missed] = comparison.missedShortcuts;

      expect(missed.kind).toBe("toolbar-instead-of-chord");
      expect(missed.savedActions).toBe(0);
      expect(missed.suggestedChordLabel).toContain("Cmd");
    });

    it("shows at most three, worst first", () => {
      const events = [
        ...Array.from({ length: 5 }, () => event("MOVE_DOWN")),
        ...Array.from({ length: 3 }, () => event("MOVE_RIGHT")),
        event("TOGGLE_BOLD", { inputMethod: "pointer", via: "toolbar" }),
        event("FORMAT_CURRENCY", { inputMethod: "pointer", via: "toolbar" }),
      ];
      const comparison = compareRoute(
        events,
        [route(["JUMP_DOWN", "JUMP_RIGHT", "TOGGLE_BOLD", "FORMAT_CURRENCY"])],
        "windows",
      );

      expect(comparison.missedShortcuts).toHaveLength(3);
      expect(comparison.missedShortcuts.map((missed) => missed.savedActions)).toEqual([4, 2, 0]);
    });
  });

  it("says less rather than more when an event carries no command", () => {
    // Replay data written before the command layer existed. The counts are still true; the route
    // diff is not knowable, and inferring it from the action is the very reconstruction the command
    // layer removed. So: no diff, no coaching, and the card explains itself.
    const events: RunEvent[] = [
      event("MOVE_DOWN"),
      { atMs: 1, action: { kind: "select-cell", cell: { row: 1, col: 0 } } },
    ];
    const comparison = compareRoute(events, [route(["JUMP_DOWN"])], "windows");

    expect(comparison.confidence).toBe("low");
    expect(comparison.matchedRouteId).toBeNull();
    expect(comparison.missedShortcuts).toEqual([]);
    expect(comparison.playerActions).toBe(1);
  });

  it("has nothing to compare against when the solver proved no route", () => {
    const comparison = compareRoute([event("MOVE_DOWN")], null, "windows");

    expect(comparison.optimalActions).toBe(0);
    expect(comparison.efficiency).toBe(0);
    expect(comparison.matchedRouteId).toBeNull();
    expect(comparison.playerActions).toBe(1);
  });

  it("measures keyboard and shortcut shares from the input evidence, not from the action", () => {
    const events = [
      event("MOVE_DOWN"),
      event("TOGGLE_BOLD", { inputMethod: "keyboard", via: "toolbar" }),
      event("CLICK_CELL", { inputMethod: "pointer", via: "grid" }),
    ];
    const comparison = compareRoute(events, [route(["MOVE_DOWN"])], "windows");

    // The middle event is a toolbar button the player reached with the keyboard: keyboard-pure, but
    // not a shortcut. Both are recorded, because they are different facts (§6.6).
    expect(comparison.keyboardActions).toBe(2);
    expect(comparison.pointerActions).toBe(1);
    expect(comparison.shortcutActions).toBe(1);
    expect(comparison.keyboardShare).toBeCloseTo(2 / 3);
    expect(comparison.shortcutShare).toBeCloseTo(1 / 3);
  });
});
