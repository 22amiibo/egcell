import type { Challenge, LeafValidationSpec } from "@/domain/challenges/challengeTypes";
import { SPEC_KIND_ACTIONS } from "@/domain/challenges/templateRegistry";
import { COMMAND_REGISTRY, KEYBOARD_COMMANDS } from "@/domain/commands/commandRegistry";
import type { GridCommandId } from "@/domain/commands/commandTypes";
import { nextFocusAnchor, resolveCommand } from "@/domain/commands/resolveCommand";
import { comparableValue } from "@/domain/grid/cellValues";
import { gridReducer } from "@/domain/grid/gridReducer";
import type {
  CellAddress,
  GridAction,
  GridActionKind,
  GridState,
  RangeAddress,
} from "@/domain/grid/gridTypes";
import { cellKey, normalizeRange } from "@/domain/grid/range";
import { getCell } from "@/domain/grid/selectors";
import type { Route, RouteStep } from "@/domain/routes/routeTypes";
import type { RunState } from "@/domain/runs/runTypes";
import { validateChallenge } from "@/domain/validation/validateChallenge";

export type SolveOptions = {
  maxDepth?: number;
  maxNodes?: number;
  maxRoutes?: number;
};

/**
 * The plan's §6.3 defaults were `maxDepth: 8`, `maxNodes: 20_000`, on the assumption that "navigate
 * to a cell holding West, then filter" would fall out of the search for free. It does not, and the
 * acceptance test caught it: a difficulty-5 table is over twenty rows tall, so a cell in the middle
 * of it is over twenty arrow presses from the corner, and every route that had to reach one came
 * back null. Depth has to clear the tallest table's arrow-walk, not a typical route's length.
 *
 * Depth is only affordable because the search is pruned to the action kinds a spec can actually use
 * (`relevantKinds`); without that, a deeper frontier multiplies range selections and the node budget
 * dies long before the depth does.
 */
const DEFAULTS = { maxDepth: 32, maxNodes: 1_000_000, maxRoutes: 3 } as const;

/**
 * How many tied shortest routes the search collects before it stops looking, so `rankRoutes` chooses
 * from the tie rather than from the first three the registry order happened to reach. Comfortably
 * above `maxRoutes` and comfortably below the point where finishing the goal layer gets expensive —
 * at 24 the search opened the whole layer and the slowest drill tripled in cost for nothing.
 */
const MAX_TIED_ROUTES = 8;

/**
 * The solver grades a hypothetical grid, so it has no run to hand the validator. It can pass this
 * one because **no validator reads its `run` argument** — validators grade the grid's end state,
 * never the route (`DECISIONS.md:195`). That is an assumption, so `solveRoute.test.ts` pins it: if a
 * validator ever starts reading `run`, that test fails loudly rather than the solver quietly lying.
 */
export const SYNTHETIC_RUN: RunState = {
  challengeId: "solver",
  challengeVersion: "solver",
  seed: "solver",
  mode: "main-speed",
  status: "running",
  startedAt: 0,
  finishedAt: null,
  elapsedMs: 0,
  events: [],
};

/**
 * A node keeps a pointer to the node it came from, rather than its own copy of the route so far.
 *
 * The route is only ever *read* for the handful of nodes that reach the goal, but a copied array
 * would be built — and a `RouteStep` minted, with a registry lookup and an argument dug out of the
 * grid — on every one of the million edges that do not. Walk the parents at the end instead; the
 * search itself never needs to know what the steps say, only where they led.
 */
type SearchNode = {
  grid: GridState;
  focus: CellAddress;
  anchor: CellAddress;
  /** This grid's cell hash, carried down and recomputed only when a step actually rewrote a cell. */
  cellsKey: string;
  parent: SearchNode | null;
  /** The command that produced this node, and the action it resolved to in the *parent's* grid. */
  command: GridCommandId | null;
  action: GridAction | null;
};

/** Materialises the route that reached this node, oldest step first. */
function stepsTo(node: SearchNode): RouteStep[] {
  const steps: RouteStep[] = [];

  for (let current = node; current.parent !== null; current = current.parent) {
    if (current.command === null || current.action === null) {
      break;
    }

    // The argument is read from the grid the action was taken *in*, which is the parent's.
    steps.push(stepFor(current.command, current.action, current.parent.grid));
  }

  return steps.reverse();
}

function at(cell: CellAddress): string {
  return `${cell.row},${cell.col}`;
}

/** The only two actions that can rewrite a cell. Everything else moves the cursor or hides rows. */
function rewritesCells(action: GridAction): boolean {
  return action.kind === "set-format" || action.kind === "sort-column";
}

/**
 * The expensive half of the signature, kept separate so it can be *reused*.
 *
 * Hashing the used range costs a few hundred cell reads, and the search does hundreds of thousands
 * of steps — but almost every one of them is an arrow key, which cannot touch a cell. So a node
 * inherits its parent's cell hash unless the step that made it was a format or a sort, and the cost
 * collapses to a handful of hashes per solve. Without this the largest formatting drill spends over
 * a second re-hashing a grid nobody changed.
 */
export function cellsHash(grid: GridState, withValues: boolean): string {
  const { start, end } = normalizeRange(grid.usedRange);
  const cells: string[] = [];

  for (let row = start.row; row <= end.row; row += 1) {
    for (let col = start.col; col <= end.col; col += 1) {
      const cell = grid.cells[cellKey({ row, col })];

      if (cell === undefined) {
        continue;
      }

      const bold = cell.format.bold === true ? "b" : "";
      const format = `${bold}${cell.format.numberFormat ?? ""}`;

      if (!withValues) {
        // A challenge that cannot sort cannot move a value, so the values are the same in every
        // state the search will ever see and hashing them says nothing. Only the formats vary.
        cells.push(format);
        continue;
      }

      // The kind belongs in the hash alongside the value: a sort moves whole cells, so the text
      // "12" and the number 12 are different cells that `comparableValue` alone would conflate.
      const value = comparableValue(cell.value) ?? "";

      cells.push(`${cell.value.kind}:${value}|${format}`);
    }
  }

  return cells.join("~");
}

/**
 * The canonical signature of a search state — **this is the cycle detection**. Without it the search
 * loops on `↓↑↓↑` forever; with it the space collapses to a few thousand states for every drill in
 * the game.
 *
 * `focus` and `anchor` are part of the state, not decoration: the reducer normalises a range so its
 * `start` is the top-left cell, which loses which end the player is moving, and two grids identical
 * on paper with different moving ends have genuinely different futures.
 *
 * `cellsKey` is passed in rather than computed, because the caller knows something this function
 * cannot: whether the step that produced this grid could have changed a cell at all.
 */
export function stateSignature(
  grid: GridState,
  focus: CellAddress,
  anchor: CellAddress,
  cellsKey: string,
): string {
  const selection = grid.selection;
  const selectionKey =
    selection.kind === "cell"
      ? `c${at(selection.cell)}`
      : selection.kind === "range"
        ? `r${at(selection.range.start)}-${at(selection.range.end)}`
        : selection.kind === "row"
          ? `w${selection.row}`
          : selection.kind === "column"
            ? `l${selection.col}${selection.usedRangeOnly ? "u" : ""}`
            : "n";
  const sort = grid.sortState;

  // Hand-built rather than JSON.stringify'd: this runs once per edge, hundreds of thousands of times
  // per solve, and stringify was the single most expensive thing left in the search.
  return [
    at(grid.activeCell),
    at(focus),
    at(anchor),
    selectionKey,
    sort === null ? "-" : `${sort.col}${sort.direction}`,
    grid.filters.map((filter) => `${filter.col}${filter.op}${String(filter.value)}`).join(","),
    grid.hiddenRows.join("."),
    cellsKey,
  ].join("/");
}

/** Only a challenge that may sort or format can change a cell; a filter merely hides rows. */
function changesCells(challenge: Challenge): boolean {
  return (
    challenge.allowedActions.includes("set-format") ||
    challenge.allowedActions.includes("sort-column")
  );
}

/** Only a sort moves a value from one cell to another. Formatting leaves every value where it is. */
function changesValues(challenge: Challenge): boolean {
  return challenge.allowedActions.includes("sort-column");
}

/**
 * The action kinds a shortest route for this spec can contain — the spec's own required actions
 * (`SPEC_KIND_ACTIONS`, the map the eligibility gate already grades every variant against) plus the
 * one prerequisite every route has: `select-cell`, because a command acts where the cursor is.
 *
 * Formatting is the one kind that needs more, and for a structural reason: `set-format` writes to
 * the *selection*, so a route must be able to make one. Sorting and filtering do not — they read the
 * focused column, so a range, row, or column selection can never shorten a sort-filter route. That
 * is not a guess: `SORT_ASC` resolves against `focus.col`, and `SELECT_COLUMN` leaves `focus` where
 * it was while clobbering `grid.activeCell` to the header row (which is the very bug §10.1 point 2
 * describes). Searching those branches only grows the frontier, which is what put a deep-navigation
 * route out of reach of the node budget in the first place.
 *
 * This narrows the search; it cannot narrow the answer. An action kind the goal cannot read and the
 * cursor does not need is a step a shortest route would have to be strictly better off without.
 */
function relevantKinds(spec: LeafValidationSpec, grid: GridState): Set<GridActionKind> {
  const kinds = new Set<GridActionKind>(SPEC_KIND_ACTIONS[spec.kind]);

  kinds.add("select-cell");

  if (spec.kind === "formatting") {
    for (const kind of SPEC_KIND_ACTIONS.selection) {
      kinds.add(kind);
    }

    // A range the player has to *build* is the expensive part of the whole search — every cell can
    // anchor one, every anchor can extend anywhere, and each of those states can then be formatted.
    // When the target is a whole column, none of that work can pay: `Ctrl+Space` covers the column
    // in one action from anywhere inside it, and an extended selection needs at least one action
    // from the same cell to cover the same ground. Extending can tie, never win, so dropping it
    // loses no route — and it is what takes the biggest formatting drill from nine seconds to one.
    //
    // **Columns only.** The same argument looks like it should hold for a row, and it does not:
    // `Shift+Space` takes the entire grid row, wider than the table, so `TOGGLE_BOLD` sees the blank
    // cells beyond the used range, concludes the selection is not all-bold, and *bolds* — which is
    // why `formatting.unbold-header` has no solve without an extended selection that stops at the
    // table's edge. `Ctrl+Space` is clipped to the used range and has no such gap. One command is
    // exact and the other is not, so only one of them can stand in for building the range by hand.
    if (coversWholeColumns(spec.range, grid)) {
      kinds.delete("select-range");
    }
  }

  if (spec.kind === "sort-filter") {
    // A filter goal is reached by filtering; clearing exists because a grid may arrive filtered.
    kinds.add("clear-filters");
  }

  return kinds;
}

/** Does this range run the full height of the table — every data row of the columns it covers? */
function coversWholeColumns(range: RangeAddress, grid: GridState): boolean {
  const target = normalizeRange(range);
  const used = normalizeRange(grid.usedRange);
  const firstDataRow = used.start.row + grid.headerRows;

  return target.start.row <= firstDataRow && target.end.row >= used.end.row;
}

/** What a step acted on, when the command alone will not say: the value filtered, the column sorted. */
function argumentFor(action: GridAction, grid: GridState): string | undefined {
  switch (action.kind) {
    case "filter-column":
      return String(action.value);
    case "sort-column": {
      const headerRow = normalizeRange(grid.usedRange).start.row;
      const header = getCell(grid, { row: headerRow, col: action.col });

      return header?.value.kind === "text" ? header.value.value : undefined;
    }
    default:
      return undefined;
  }
}

function stepFor(command: GridCommandId, action: GridAction, grid: GridState): RouteStep {
  const definition = COMMAND_REGISTRY[command];
  const argument = argumentFor(action, grid);

  return {
    command,
    label: definition.description,
    // Uniform today; two fields from day one, so a real weight later is a data change (§1a.5).
    cost: definition.cost,
    ...(argument === undefined ? {} : { argument }),
  };
}

type Search = {
  /** Every shortest command sequence found, up to `maxRoutes`. */
  routes: RouteStep[][];
  /** True when the search ran out of depth, nodes, or moves without ever reaching the goal. */
  exhausted: boolean;
};

/**
 * Breadth-first over the keyboard commands, from `start`, until the challenge grades complete.
 *
 * Commands are iterated in the registry's own order, so which of two tied routes comes back first is
 * reproducible across runs and machines rather than an accident of object-key order (§1a.5).
 *
 * The failure mode is **exhaustion, never a best-effort route**: a caller that gets nothing must say
 * "no fastest path is recorded for this drill", not show a route that might not actually solve it.
 */
function bfs(
  challenge: Challenge,
  spec: LeafValidationSpec,
  start: GridState,
  focus: CellAddress,
  anchor: CellAddress,
  options: Required<SolveOptions>,
): Search {
  const hashCells = changesCells(challenge);
  const hashValues = changesValues(challenge);
  const searchable = relevantKinds(spec, start);
  const isComplete = (grid: GridState) =>
    validateChallenge({ challenge, grid, run: SYNTHETIC_RUN }).isComplete;

  if (isComplete(start)) {
    return { routes: [[]], exhausted: false };
  }

  const startCellsKey = hashCells ? cellsHash(start, hashValues) : "";
  const visited = new Set<string>([stateSignature(start, focus, anchor, startCellsKey)]);
  let frontier: SearchNode[] = [
    {
      grid: start,
      focus,
      anchor,
      cellsKey: startCellsKey,
      parent: null,
      command: null,
      action: null,
    },
  ];
  const routes: RouteStep[][] = [];
  let nodes = 0;

  for (let depth = 0; depth < options.maxDepth; depth += 1) {
    const next: SearchNode[] = [];

    for (const node of frontier) {
      for (const command of KEYBOARD_COMMANDS) {
        if (nodes >= options.maxNodes) {
          // Out of budget. Honest exhaustion beats a route that might not solve the challenge.
          return { routes, exhausted: routes.length === 0 };
        }

        nodes += 1;

        const action = resolveCommand(command, {
          grid: node.grid,
          focus: node.focus,
          anchor: node.anchor,
        });

        if (action === null) {
          continue;
        }

        // The same gate the live grid applies to every dispatch (`SpreadsheetGrid.tsx`'s `allows`).
        // Without it the solver searches actions the game would refuse — a navigation drill permits
        // only `select-cell`, so a route through `EXTEND_DOWN` is a route the player cannot press.
        // It can never hide a real route: the game accepts nothing outside `allowedActions`, so a
        // route this drops was never playable. Collapsing those branches is the side effect.
        //
        // Both gates read the *resolved* action, never the command: `TOGGLE_FILTER` is one command
        // that resolves to `filter-column` or `clear-filters` depending on the grid, so a static
        // command-to-kind table would get it wrong exactly where it matters.
        if (!challenge.allowedActions.includes(action.kind) || !searchable.has(action.kind)) {
          continue;
        }

        // A range selection this search *built* is only worth having if the next thing you do is
        // *use* it. Any step that throws it away — an arrow, a jump, a fresh row selection — lands
        // in precisely the state you would have reached by taking those same steps and never
        // extending at all, at the same depth, because `EXTEND_DOWN` moves the focus exactly as far
        // as `MOVE_DOWN` does. The plain path is already in the search, so these edges cannot
        // shorten any route; all they do is fan every range state out across sixteen navigation
        // commands, which is what put the deeper formatting drills out of reach of the budget.
        //
        // **Never at the root.** That argument holds only for a range the search extended into,
        // because it compares against the cheaper path that skipped the extending. A search can
        // *begin* holding a range — a composite's second part starts wherever the first one left
        // off, and formatting leaves both ends of the selection exactly where they were — and there
        // is no cheaper path to compare it against, because it cost nothing. Pruning there told the
        // solver a player who has just bolded a row may never move again, and it dutifully reported
        // that the challenge could not be solved.
        const extending =
          node.parent !== null &&
          (node.focus.row !== node.anchor.row || node.focus.col !== node.anchor.col);

        if (extending && action.kind !== "select-range" && action.kind !== "set-format") {
          continue;
        }

        const grid = gridReducer(node.grid, action);

        // The reducer hands back the identical object for an action that changes nothing, so a
        // command with nowhere to go prunes itself for free.
        if (grid === node.grid) {
          continue;
        }

        const ends = nextFocusAnchor(action, node.focus, {
          focus: node.focus,
          anchor: node.anchor,
        });
        // Arrow keys cannot rewrite a cell, so the overwhelming majority of nodes inherit their
        // parent's hash instead of re-reading the grid. This is the difference between the largest
        // formatting drill taking a second and taking a few milliseconds.
        const cellsKey =
          hashCells && rewritesCells(action) ? cellsHash(grid, hashValues) : node.cellsKey;
        const signature = stateSignature(grid, ends.focus, ends.anchor, cellsKey);

        if (visited.has(signature)) {
          continue;
        }

        const reached: SearchNode = {
          grid,
          focus: ends.focus,
          anchor: ends.anchor,
          cellsKey,
          parent: node,
          command,
          action,
        };

        if (isComplete(grid)) {
          routes.push(stepsTo(reached));

          // Collect the whole tie, not the first `maxRoutes` of it: the caller ranks these by how
          // much of the sheet they disturb, and stopping at three would throw away the gentlest
          // route before anyone got to compare it. The layer is finished either way — everything
          // deeper is strictly longer — so this only bounds a pathological tie.
          if (routes.length >= MAX_TIED_ROUTES) {
            return { routes, exhausted: false };
          }

          continue;
        }

        // A solved state is never expanded, and a state already seen is never re-queued.
        visited.add(signature);
        next.push(reached);
      }
    }

    if (routes.length > 0) {
      return { routes, exhausted: false };
    }

    if (next.length === 0) {
      // The reachable space is exhausted and the goal was never met: there is no keyboard route.
      return { routes, exhausted: true };
    }

    frontier = next;
  }

  return { routes, exhausted: routes.length === 0 };
}

/** Replays a command sequence from a state, the way `SpreadsheetGrid` would. Null if a step dies. */
function replay(
  start: GridState,
  focus: CellAddress,
  anchor: CellAddress,
  steps: RouteStep[],
): { grid: GridState; focus: CellAddress; anchor: CellAddress } | null {
  let grid = start;
  let currentFocus = focus;
  let currentAnchor = anchor;

  for (const step of steps) {
    const action = resolveCommand(step.command, {
      grid,
      focus: currentFocus,
      anchor: currentAnchor,
    });

    if (action === null) {
      return null;
    }

    const ends = nextFocusAnchor(action, currentFocus, {
      focus: currentFocus,
      anchor: currentAnchor,
    });

    grid = gridReducer(grid, action);
    currentFocus = ends.focus;
    currentAnchor = ends.anchor;
  }

  return { grid, focus: currentFocus, anchor: currentAnchor };
}

/** How many cells a route rewrites. Selections and filters disturb nothing; a format or sort does. */
function disturbance(
  before: GridState,
  focus: CellAddress,
  anchor: CellAddress,
  steps: RouteStep[],
): number {
  const played = replay(before, focus, anchor, steps);

  if (played === null) {
    return Number.MAX_SAFE_INTEGER;
  }

  let changed = 0;

  for (const [key, after] of Object.entries(played.grid.cells)) {
    const original = before.cells[key];

    // The reducer replaces a cell object only when it rewrites it, so identity is the comparison.
    if (original === undefined || original.value !== after.value || original.format !== after.format) {
      changed += 1;
    }
  }

  return changed;
}

/**
 * Ranks the tie. Every route here costs the same — that is what a tie is — so the question is which
 * of them to *teach*, and the answer is the one that does the least to the sheet.
 *
 * This is not a nicety. `validateFormatting` grades only the range the challenge names and never
 * punishes formatting outside it, so "select the whole table, press Ctrl+B" genuinely solves "bold
 * the Name values" in two actions — the same two as "select the column, press Ctrl+B". Both are
 * shortest. Only one of them is a thing to tell a player to do. Left to registry order the solver
 * picked the wrong one, and it was right to: nothing had told it that scribbling over two hundred
 * cells to change twenty was worse.
 *
 * Disturbance is measured from the engine, not from the spec: no knowledge of what the challenge
 * wants, only of how many cells the route rewrote. Ties within the tie keep discovery order, which
 * the registry fixes, so the result stays reproducible across runs and machines (§1a.5).
 */
function rankRoutes(
  before: GridState,
  focus: CellAddress,
  anchor: CellAddress,
  routes: RouteStep[][],
): RouteStep[][] {
  return routes
    .map((steps, index) => ({
      steps,
      index,
      disturbed: disturbance(before, focus, anchor, steps),
    }))
    .sort((left, right) =>
      left.disturbed === right.disturbed
        ? left.index - right.index
        : left.disturbed - right.disturbed,
    )
    .map((ranked) => ranked.steps);
}

function routeFrom(
  challenge: Challenge,
  steps: RouteStep[],
  index: number,
  nearOptimal: boolean,
): Route {
  const counted = steps.filter((step) => step.optional !== true);

  return {
    id: `${challenge.id}:${challenge.seed}:${index}`,
    label: "Keyboard route",
    kind: "keyboard",
    steps,
    optimalActions: counted.length,
    optimalCost: counted.reduce((sum, step) => sum + step.cost, 0),
    // Every step came from KEYBOARD_COMMANDS, so this holds by construction, not by inspection.
    keyboardComplete: steps.every((step) => COMMAND_REGISTRY[step.command].hotkeyEligible),
    source: "solver",
    version: challenge.version,
    nearOptimal,
  };
}

/** A composite's part, solved as if it were the whole challenge — validators read only the spec. */
function partChallenge(challenge: Challenge, part: LeafValidationSpec): Challenge {
  return { ...challenge, validation: part };
}

/**
 * Composites are solved leaf by leaf: search the first part, then search the second from the state
 * the first one reached, and concatenate. This is *near*-optimal, not provably optimal — a globally
 * better route might interleave the parts — so the route is flagged `nearOptimal`, and the card will
 * say "a fast path", never "the fastest path". A joint search at depth 12+ is not worth the budget.
 *
 * Each part's steps carry a group, so the card can say the parts may be done in either order.
 */
function solveComposite(
  challenge: Challenge,
  parts: LeafValidationSpec[],
  options: Required<SolveOptions>,
): Route[] | null {
  let grid = challenge.initialGrid;
  let focus = grid.activeCell;
  let anchor = grid.activeCell;
  const steps: RouteStep[] = [];

  for (const [index, part] of parts.entries()) {
    const search = bfs(partChallenge(challenge, part), part, grid, focus, anchor, options);
    // A part's tie is ranked exactly like a whole challenge's: gentlest first. Otherwise a composite
    // could bold the entire table on its way to bolding one row, and be "optimal" doing it.
    const solution = rankRoutes(grid, focus, anchor, search.routes)[0];

    if (solution === undefined) {
      // One unsolvable part makes the whole composite unsolvable by keyboard. Null, not a partial.
      return null;
    }

    const group = `part-${index + 1}`;

    for (const step of solution) {
      steps.push({ ...step, group });
    }

    // Advance to the state the next part searches from, by replaying this part's own steps.
    const played = replay(grid, focus, anchor, solution);

    if (played === null) {
      return null;
    }

    grid = played.grid;
    focus = played.focus;
    anchor = played.anchor;
  }

  return [routeFrom(challenge, steps, 0, true)];
}

/**
 * The fastest keyboard route(s) to a challenge, or `null` when the search cannot prove one inside
 * its budget. Never a partial or best-effort route: `null` means the card says "no fastest path is
 * available for this drill", and it never invents one.
 *
 * The route is discovered from the engine's own semantics rather than authored — which is why it
 * gets right the four things a human author gets wrong today: the header counting as data for
 * `Ctrl+Up`; `Ctrl+Space` beating a click plus `Ctrl+Shift+Down`; `Ctrl+Space` clobbering
 * `activeCell` and breaking a subsequent filter; and the difficulty-4/5 table offset changing the
 * route entirely.
 */
export function solveRoute(challenge: Challenge, options: SolveOptions = {}): Route[] | null {
  const settings = { ...DEFAULTS, ...options };
  const spec = challenge.validation;

  if (spec.kind === "composite") {
    return solveComposite(challenge, spec.parts, settings);
  }

  const grid = challenge.initialGrid;
  const search = bfs(challenge, spec, grid, grid.activeCell, grid.activeCell, settings);

  if (search.routes.length === 0) {
    return null;
  }

  return rankRoutes(grid, grid.activeCell, grid.activeCell, search.routes)
    .slice(0, settings.maxRoutes)
    .map((steps, index) => routeFrom(challenge, steps, index, false));
}
