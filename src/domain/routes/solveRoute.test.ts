import { describe, expect, it } from "vitest";

import { challenges } from "@/data/challenges";
import { generatedTemplates } from "@/data/challenges/generated";
import { DATASET_THEMES } from "@/data/datasets/themes";
import type {
  Challenge,
  ChallengeDifficulty,
  LeafValidationSpec,
} from "@/domain/challenges/challengeTypes";
import { generateVariant } from "@/domain/challenges/generateVariant";
import type { ChallengeTemplate, ChallengeVariant } from "@/domain/challenges/variantTypes";
import { COMMAND_REGISTRY } from "@/domain/commands/commandRegistry";
import { nextFocusAnchor, resolveCommand } from "@/domain/commands/resolveCommand";
import { gridReducer } from "@/domain/grid/gridReducer";
import type { CellAddress, GridAction, GridState } from "@/domain/grid/gridTypes";
import type { Route } from "@/domain/routes/routeTypes";
import { SYNTHETIC_RUN, solveRoute } from "@/domain/routes/solveRoute";
import type { RunState } from "@/domain/runs/runTypes";
import { validateChallenge } from "@/domain/validation/validateChallenge";

const DIFFICULTIES: ChallengeDifficulty[] = [1, 2, 3, 4, 5];

function templateFor(id: string): ChallengeTemplate {
  const found = generatedTemplates.find((template) => template.id === id);

  if (found === undefined) {
    throw new Error(`Missing template ${id}.`);
  }

  return found;
}

function draw(id: string, seed: string, difficulty: ChallengeDifficulty): ChallengeVariant {
  const variant = generateVariant({
    template: templateFor(id),
    themes: DATASET_THEMES,
    seed,
    difficulty,
  });

  if (variant === null) {
    throw new Error(`${id} failed to generate for seed ${seed} at difficulty ${difficulty}.`);
  }

  return variant;
}

function isComplete(challenge: Challenge, grid: GridState): boolean {
  return validateChallenge({ challenge, grid, run: SYNTHETIC_RUN }).isComplete;
}

/**
 * Replays a route the way a player would: every command through `resolveCommand`, every action
 * through the real reducer, the anchor tracked by the same `nextFocusAnchor` the live grid uses.
 *
 * This is what makes a route a claim rather than a decoration. The solver could be searching a space
 * that has drifted from the one the app runs in; a replay ending in a grid the real validator grades
 * complete is the proof that it has not.
 *
 * `COMMIT_EDIT` is the one step that reads `editBuffer` at all (§the edit lifecycle); every other
 * command ignores it, so handing it the step's own `argument` here — and `null` everywhere else — is
 * exactly what a player's keystrokes would leave sitting in the buffer at the moment they commit.
 */
function replay(challenge: Challenge, route: Route): GridState {
  let grid = challenge.initialGrid;
  let focus: CellAddress = grid.activeCell;
  let anchor: CellAddress = grid.activeCell;

  for (const step of route.steps) {
    const action = resolveCommand(step.command, {
      grid,
      focus,
      anchor,
      editBuffer: step.command === "COMMIT_EDIT" ? (step.argument ?? null) : null,
    });

    if (action === null) {
      throw new Error(`${challenge.id}: ${step.command} resolved to nothing mid-route.`);
    }

    const ends = nextFocusAnchor(action, focus, { focus, anchor });

    grid = gridReducer(grid, action);
    focus = ends.focus;
    anchor = ends.anchor;
  }

  return grid;
}

/**
 * A `RunState` that screams if it is touched.
 *
 * The solver grades hypothetical grids, so it has no run to hand the validator — it passes
 * `SYNTHETIC_RUN`, and it gets away with that only because no validator reads its `run` argument.
 * That is an assumption about code the solver does not own, and an unpinned assumption is a bug with
 * a delay on it: a validator that started grading the run (an action count, an elapsed time) would
 * make every route the solver returns quietly wrong, and nothing else in the suite would notice.
 *
 * So pin it. If a validator ever reads `run`, this proxy throws, and the failure lands here next to
 * the explanation rather than surfacing later as routes that are subtly wrong for invisible reasons.
 */
function forbiddenRun(challenge: Challenge): RunState {
  return new Proxy({} as RunState, {
    get(_target, property) {
      throw new Error(
        `A validator read run.${String(property)} while grading ${challenge.id}. ` +
          "The route solver has no run to give it — see SYNTHETIC_RUN in solveRoute.ts. Either the " +
          "validator must stop reading the run, or the solver must be given a real one.",
      );
    },
  });
}

describe("the solver's load-bearing assumption: no validator reads its run", () => {
  it.each(challenges)("$id grades without touching the run", (challenge) => {
    expect(() =>
      validateChallenge({
        challenge,
        grid: challenge.initialGrid,
        run: forbiddenRun(challenge),
      }),
    ).not.toThrow();
  });

  it("holds for a solved grid too, not only an untouched one", () => {
    // A validator is likelier to reach for the run on the completing action — to score it — than on
    // a grid nowhere near done. Grade the end state as well as the start.
    for (const challenge of challenges) {
      const routes = solveRoute(challenge);

      if (routes === null) {
        continue;
      }

      const solved = replay(challenge, routes[0]);

      expect(() =>
        validateChallenge({ challenge, grid: solved, run: forbiddenRun(challenge) }),
      ).not.toThrow();
    }
  });

  it("holds for every generated family, not only the hand-written classics", () => {
    for (const template of generatedTemplates) {
      const variant = draw(template.id, `run-proxy-${template.id}`, 3);

      expect(() =>
        validateChallenge({
          challenge: variant,
          grid: variant.initialGrid,
          run: forbiddenRun(variant),
        }),
      ).not.toThrow();
    }
  });
});

describe("solveRoute — a route that actually solves the challenge", () => {
  it.each([
    "gen.navigation.last-in-column",
    "gen.selection.column",
    "gen.formatting.bold-column",
    "gen.sort-filter.sort-numeric",
    "gen.mixed.sort-and-format",
  ])("%s: the route replays through the real reducer to a grid the real validator passes", (id) => {
    const variant = draw(id, `replay-${id}`, 3);
    const routes = solveRoute(variant);

    expect(routes).not.toBeNull();
    expect(isComplete(variant, variant.initialGrid)).toBe(false);

    const route = (routes as Route[])[0];

    expect(route.steps.length).toBeGreaterThan(0);
    expect(isComplete(variant, replay(variant, route))).toBe(true);
  });

  it("returns keyboard-complete routes: every step has a chord or a menu path", () => {
    const variant = draw("gen.sort-filter.filter-equals", "kb-complete", 3);
    const routes = solveRoute(variant);

    expect(routes).not.toBeNull();

    for (const route of routes as Route[]) {
      expect(route.keyboardComplete).toBe(true);

      for (const step of route.steps) {
        expect(COMMAND_REGISTRY[step.command].hotkeyEligible).toBe(true);
      }
    }
  });

  it("counts and costs the same route two ways, so a weighted command later is a data change", () => {
    const variant = draw("gen.navigation.corner", "cost", 3);
    const route = (solveRoute(variant) as Route[])[0];

    expect(route.optimalActions).toBe(route.steps.length);
    // Every cost is 1 today, so the two coincide. The point is that they are two fields (§1a.5).
    expect(route.optimalCost).toBe(route.optimalActions);
  });
});

describe("solveRoute — ties and budgets", () => {
  it("returns every shortest route when several tie, not an arbitrary one of them", () => {
    // The bottom-right corner is reachable by jumping down then right, or right then down. Both are
    // two actions and neither is more correct; a solver returning one would be hiding the other.
    const variant = draw("gen.navigation.corner", "tie", 3);
    const routes = solveRoute(variant);

    expect(routes).not.toBeNull();
    expect((routes as Route[]).length).toBeGreaterThan(1);

    const lengths = new Set((routes as Route[]).map((route) => route.optimalActions));

    expect(lengths.size).toBe(1);

    const sequences = (routes as Route[]).map((route) =>
      route.steps.map((step) => step.command).join(","),
    );

    expect(new Set(sequences).size).toBe(sequences.length);

    for (const route of routes as Route[]) {
      expect(isComplete(variant, replay(variant, route))).toBe(true);
    }
  });

  it("returns null past its node budget rather than a route it cannot prove", () => {
    const variant = draw("gen.mixed.sort-and-format", "budget-nodes", 5);

    expect(solveRoute(variant, { maxNodes: 1 })).toBeNull();
  });

  it("returns null past its depth budget rather than a partial route", () => {
    const variant = draw("gen.formatting.bold-column", "budget-depth", 3);
    const optimal = (solveRoute(variant) as Route[])[0].optimalActions;

    // One action short of the optimum, the honest answer is "no route" — never the first half of
    // one, because half a route shown to a player is a route that does not work.
    expect(solveRoute(variant, { maxDepth: optimal - 1 })).toBeNull();
    expect(solveRoute(variant, { maxDepth: optimal })).not.toBeNull();
  });
});

/**
 * §10.1: four of the shipped `practiceNotes` are wrong. They are prose — written once, never checked
 * against the engine, and the engine moved underneath them. These four tests are the reason the
 * solver exists: each pins a route a human author got wrong.
 */
describe("solveRoute — the routes the hand-authored notes get wrong", () => {
  it("gen.navigation.first-in-column: never Ctrl+Up, because the header is filled too", () => {
    // The shipped note says "ride Ctrl+Up from below". Wrong: the header holds text, so the edge
    // jump treats it as filled and overshoots the first entry, landing on the header itself.
    for (const difficulty of DIFFICULTIES) {
      const variant = draw("gen.navigation.first-in-column", `first-${difficulty}`, difficulty);
      const routes = solveRoute(variant);

      expect(routes).not.toBeNull();

      for (const route of routes as Route[]) {
        expect(route.steps.map((step) => step.command)).not.toContain("JUMP_UP");
        expect(isComplete(variant, replay(variant, route))).toBe(true);
      }
    }
  });

  it("gen.formatting.bold-column: no worse than the note, and never by bolding the sheet", () => {
    // The note says: click the first value, Ctrl+Shift+Down to take the rest, then Ctrl+B — three
    // actions, one of them a mouse click. The solver's route is keyboard-only and no longer, ending
    // in a bold applied to a selection it built itself.
    //
    // SELECT_TABLE is the route this must never be. Ctrl+A then Ctrl+B is shorter still, and until
    // the spill rule landed it *passed* — which is how the solver found that exploit in the first
    // place. If this ever fails on SELECT_TABLE, grading has regressed, not the search.
    for (const difficulty of DIFFICULTIES) {
      const variant = draw("gen.formatting.bold-column", `bold-col-${difficulty}`, difficulty);
      const route = (solveRoute(variant) as Route[])[0];
      const commands = route.steps.map((step) => step.command);

      // Ctrl+A is allowed to appear as a *move* — selecting the table drops the focus on its
      // bottom-right corner, which is a cheap way to reach a far column. What must never appear is
      // Ctrl+A followed by Ctrl+B: that is the exploit, and the spill rule is what forbids it.
      for (const [index, command] of commands.entries()) {
        if (command === "SELECT_TABLE") {
          expect(commands[index + 1]).not.toBe("TOGGLE_BOLD");
        }
      }

      expect(commands.at(-1)).toBe("TOGGLE_BOLD");
      expect(route.keyboardComplete).toBe(true);
      expect(isComplete(variant, replay(variant, route))).toBe(true);
    }
  });

  it("bolding the whole sheet no longer solves bolding one column", () => {
    // The exploit itself, pinned from the other side: the two actions that used to win now fail.
    const variant = draw("gen.formatting.bold-column", "exploit", 3);
    const table = resolveCommand("SELECT_TABLE", {
      grid: variant.initialGrid,
      focus: variant.initialGrid.activeCell,
      anchor: variant.initialGrid.activeCell,
      editBuffer: null,
    });

    expect(table).not.toBeNull();

    const selected = gridReducer(variant.initialGrid, table as GridAction);
    const bold = resolveCommand("TOGGLE_BOLD", {
      grid: selected,
      focus: selected.activeCell,
      anchor: selected.activeCell,
      editBuffer: null,
    });

    expect(bold).not.toBeNull();
    expect(isComplete(variant, gridReducer(selected, bold as GridAction))).toBe(false);
  });

  it("gen.mixed.sort-and-format: the route survives Ctrl+Space clobbering the active cell", () => {
    // Ctrl+Space (`select-column`) moves the grid's active cell, and the active cell is what a later
    // sort or filter reads. A hand-authored chain that formats a column and then filters silently
    // filters the wrong one. The solver searches the state it actually lands in, so its chain
    // replays clean — at every difficulty, including the offset tables.
    for (const difficulty of DIFFICULTIES) {
      const variant = draw("gen.mixed.sort-and-format", `mixed-${difficulty}`, difficulty);
      const routes = solveRoute(variant);

      expect(routes).not.toBeNull();
      expect(isComplete(variant, replay(variant, (routes as Route[])[0]))).toBe(true);
    }
  });

  it("the same template at a different difficulty is a different route", () => {
    // Difficulty 4 and 5 offset the table away from A1, so the moves needed to reach a column change.
    // One authored note per template cannot be right for both; one route per (template, difficulty)
    // is the smallest unit that can be — which is exactly what `challenge.id` already keys.
    const easy = draw("gen.navigation.last-in-column", "offset", 1);
    const hard = draw("gen.navigation.last-in-column", "offset", 5);
    const easyRoute = (solveRoute(easy) as Route[])[0];
    const hardRoute = (solveRoute(hard) as Route[])[0];

    expect(isComplete(easy, replay(easy, easyRoute))).toBe(true);
    expect(isComplete(hard, replay(hard, hardRoute))).toBe(true);
  });
});

/**
 * Task 2.6: typing tasks (`cell-value`, `formula`) are routed, never searched. The BFS stays sound
 * over `KEYBOARD_COMMANDS` only because `COMMIT_EDIT` is off-limits to it (§1.3); these tests pin
 * that the solver still produces a route for a typing drill — navigation, plus exactly one commit —
 * rather than quietly falling through to `null`.
 */
describe("solveRoute — typing tasks route as navigation plus one authored commit", () => {
  it("routes a typing task as navigation plus one commit", () => {
    const variant = draw("gen.formula.sum-column", "typing-route", 3);
    const routes = solveRoute(variant);

    expect(routes).not.toBeNull();

    const route = (routes as Route[])[0];
    const steps = route.steps;

    // The label comes from the registry, same as every other step (§stepFor) — never an
    // authored string baked into the typing branch.
    expect(steps.at(-1)).toMatchObject({
      command: "COMMIT_EDIT",
      label: COMMAND_REGISTRY.COMMIT_EDIT.description,
      cost: 1,
    });
    expect(steps.slice(0, -1).every((step) => step.command !== "COMMIT_EDIT")).toBe(true);
    expect(route.keyboardComplete).toBe(true);
  });

  it.each(["gen.formula.sum-column", "gen.formula.average-column", "gen.formula.copy-value"])(
    "%s: replaying the typing route through the real reducer passes the real validator",
    (id) => {
      for (const difficulty of DIFFICULTIES) {
        const variant = draw(id, `typing-replay-${id}-${difficulty}`, difficulty);
        const routes = solveRoute(variant);

        expect(routes).not.toBeNull();

        const route = (routes as Route[])[0];

        expect(isComplete(variant, variant.initialGrid)).toBe(false);
        expect(isComplete(variant, replay(variant, route))).toBe(true);
      }
    },
  );

  it("refuses composites that contain a typing leaf", () => {
    const variant = draw("gen.formula.sum-column", "typing-composite", 3);
    const compositeWithTypingLeaf: Challenge = {
      ...variant,
      validation: {
        kind: "composite",
        parts: [
          { kind: "navigation", requiredCell: variant.initialGrid.activeCell },
          variant.validation as LeafValidationSpec,
        ],
      },
    };

    expect(solveRoute(compositeWithTypingLeaf)).toBeNull();
  });

  it("never proposes an edit command for a non-typing challenge", () => {
    const variant = draw("gen.navigation.last-in-column", "no-typing", 3);
    const routes = solveRoute(variant);

    expect(routes).not.toBeNull();
    expect(
      (routes as Route[]).flatMap((route) => route.steps.map((step) => step.command)),
    ).not.toContain("COMMIT_EDIT");
  });
});

describe("solveRoute — every shipped challenge has a route", () => {
  it.each(challenges)("$id: the solver finds a route and it solves the challenge", (challenge) => {
    const routes = solveRoute(challenge);

    expect(routes).not.toBeNull();
    expect(isComplete(challenge, replay(challenge, (routes as Route[])[0]))).toBe(true);
  });

  const variants = generatedTemplates.flatMap((template) =>
    DIFFICULTIES.map((difficulty) => ({
      id: `${template.id} @ d${difficulty}`,
      variant: draw(template.id, `route-${template.id}-${difficulty}`, difficulty),
    })),
  );

  it.each(variants)("$id: the solver finds a route and it solves the challenge", ({ variant }) => {
    const routes = solveRoute(variant);

    expect(routes).not.toBeNull();
    expect(isComplete(variant, replay(variant, (routes as Route[])[0]))).toBe(true);
  });

  // There is deliberately no wall-clock performance test here.
  //
  // A search that explodes exhausts its node budget and returns null, and the case above asserts a
  // route for every shipped variant — so a lost prune fails loudly and deterministically, on this
  // machine and on CI alike. Wall-clock cannot do that job: it swings by a factor of two with
  // whatever else the suite is running, and a threshold tight enough to catch a real regression
  // fails on a loaded box. Vitest's own per-test timeout is the backstop against an outright hang.
  //
  // For the record: the slowest shipped variants are the deepest keyboard walks — `row-by-name` and
  // `formatting.percent` at difficulty 5, where the target sits many arrow presses inside an offset
  // table — at roughly half a second each. The solver never runs during a live scored run and
  // memoises on `${id}:${seed}` (§6.3), so that costs a player nothing, but **Phase 5 must keep the
  // solve off the render path**: half a second on the result card's mount would be seen.
});
