import { COMMAND_REGISTRY } from "@/domain/commands/commandRegistry";
import type { GridCommandId } from "@/domain/commands/commandTypes";
import { chordLabel } from "@/domain/commands/keymap";
import type { Route } from "@/domain/routes/routeTypes";
import type { RunEvent } from "@/domain/runs/runTypes";
import type { Platform } from "@/lib/platform";

export type MissedShortcut = {
  kind: "repeated-step" | "pointer-instead-of-key" | "toolbar-instead-of-chord";
  /** What the player did, in their own terms: "4 × Move down one cell". */
  observed: string;
  suggested: GridCommandId;
  /** Platform-resolved, e.g. "Ctrl + ↓". */
  suggestedChordLabel: string;
  savedActions: number;
};

export type RouteComparison = {
  optimalActions: number;
  playerActions: number;
  extraActions: number;
  /** clamp(optimal / player, 0, 1). One means the player walked a shortest route. */
  efficiency: number;
  keyboardActions: number;
  pointerActions: number;
  /** Fired by a chord, as opposed to a toolbar button or the grid — what the trainer is for. */
  shortcutActions: number;
  keyboardShare: number;
  shortcutShare: number;
  /** The shortest route the player actually walked, when they walked one. */
  matchedRouteId: string | null;
  missedShortcuts: MissedShortcut[];
  /**
   * "low" means some event arrived without a command — replay data written before the command layer
   * existed, or an input path that failed to mint one. The card then shows counts and hides the
   * route diff: saying less is the honest failure. Guessing which command produced an action is
   * exactly the after-the-fact reconstruction this architecture exists to make unnecessary (§1a.2).
   */
  confidence: "high" | "low";
};

/** How many missed shortcuts a card shows. More than three is noise on a forty-action run. */
const MAX_MISSED = 3;

/** A run of this many identical single-steps is the thing a jump exists to replace. */
const MIN_REPEAT = 3;

/** The jump that covers the same ground as a run of one-cell steps. */
const JUMP_FOR_STEP: Partial<Record<GridCommandId, GridCommandId>> = {
  MOVE_UP: "JUMP_UP",
  MOVE_DOWN: "JUMP_DOWN",
  MOVE_LEFT: "JUMP_LEFT",
  MOVE_RIGHT: "JUMP_RIGHT",
  EXTEND_UP: "EXTEND_JUMP_UP",
  EXTEND_DOWN: "EXTEND_JUMP_DOWN",
  EXTEND_LEFT: "EXTEND_JUMP_LEFT",
  EXTEND_RIGHT: "EXTEND_JUMP_RIGHT",
};

/** The keyboard command a pointer command duplicates. */
const KEY_FOR_POINTER: Partial<Record<GridCommandId, GridCommandId>> = {
  CLICK_COLUMN_HEADER: "SELECT_COLUMN",
  CLICK_ROW_HEADER: "SELECT_ROW",
  DRAG_SELECT_RANGE: "EXTEND_JUMP_DOWN",
};

export type PlayerAction = {
  command: GridCommandId;
  event: RunEvent;
};

/**
 * The player's actions as a command stream.
 *
 * Consecutive `DRAG_SELECT_RANGE`s collapse to one: a drag fires a `select-range` per pointer move,
 * and counting one gesture as eleven actions would invent an inefficiency the player never
 * committed (§6.6). Everything else is one action per event — including a held arrow key, because N
 * grid moves genuinely happened and the count should say so.
 */
export function commandStream(events: RunEvent[]): PlayerAction[] {
  const stream: PlayerAction[] = [];

  for (const event of events) {
    if (event.command === undefined) {
      continue;
    }

    const previous = stream.at(-1);

    if (
      previous !== undefined &&
      previous.command === "DRAG_SELECT_RANGE" &&
      event.command === "DRAG_SELECT_RANGE"
    ) {
      // The same gesture, still going. Keep the newest event, so the range recorded is where the
      // drag ended rather than where it first twitched.
      stream[stream.length - 1] = { command: event.command, event };
      continue;
    }

    stream.push({ command: event.command, event });
  }

  return stream;
}

/** Runs of the same command, in order: the raw material of the repeated-step detector. */
function runsOf(stream: PlayerAction[]): Array<{ command: GridCommandId; length: number }> {
  const runs: Array<{ command: GridCommandId; length: number }> = [];

  for (const action of stream) {
    const last = runs.at(-1);

    if (last !== undefined && last.command === action.command) {
      last.length += 1;
      continue;
    }

    runs.push({ command: action.command, length: 1 });
  }

  return runs;
}

function missed(
  kind: MissedShortcut["kind"],
  observed: string,
  suggested: GridCommandId,
  savedActions: number,
  platform: Platform,
): MissedShortcut | null {
  const label = chordLabel(suggested, platform);

  // No chord, nothing to teach: a shortcut the player cannot press is not a shortcut.
  return label === null
    ? null
    : { kind, observed, suggested, suggestedChordLabel: label, savedActions };
}

/** One lesson per suggested chord. Telling a player about `Ctrl + ↓` three times is nagging. */
function dedupe(shortcuts: MissedShortcut[]): MissedShortcut[] {
  const byCommand = new Map<GridCommandId, MissedShortcut>();

  for (const shortcut of shortcuts) {
    const existing = byCommand.get(shortcut.suggested);

    if (existing === undefined || shortcut.savedActions > existing.savedActions) {
      byCommand.set(shortcut.suggested, shortcut);
    }
  }

  return [...byCommand.values()];
}

/**
 * The three detectors (§6.7), ranked by what they save and capped at three.
 *
 * Each is a claim that the player could have done the same work with fewer actions, so each has to
 * be *true*, not merely plausible. A run of arrows is only a miss when the fastest route actually
 * uses the jump that replaces it — if the solver never reached for it here, the shortcut does not
 * apply to this challenge and no coaching should pretend it does.
 */
function detectMissedShortcuts(
  stream: PlayerAction[],
  route: Route | null,
  platform: Platform,
): MissedShortcut[] {
  const found: MissedShortcut[] = [];
  const routeCommands = new Set(route?.steps.map((step) => step.command) ?? []);

  for (const run of runsOf(stream)) {
    const jump = JUMP_FOR_STEP[run.command];

    if (jump === undefined || run.length < MIN_REPEAT || !routeCommands.has(jump)) {
      continue;
    }

    const suggestion = missed(
      "repeated-step",
      `${run.length} × ${COMMAND_REGISTRY[run.command].description}`,
      jump,
      run.length - 1,
      platform,
    );

    if (suggestion !== null) {
      found.push(suggestion);
    }
  }

  // A toolbar click and its chord are one action each, so these save nothing — the player is not
  // slower for having clicked, they are just not building the habit this game exists to build. They
  // rank below anything that saves a real action, and the cap drops them first.
  for (const action of stream) {
    const definition = COMMAND_REGISTRY[action.command];
    const viaControl = action.event.via === "toolbar" || action.event.via === "menu";

    if (viaControl && definition.label !== null) {
      const suggestion = missed(
        "toolbar-instead-of-chord",
        `Toolbar: ${definition.description}`,
        action.command,
        0,
        platform,
      );

      if (suggestion !== null) {
        found.push(suggestion);
      }

      continue;
    }

    const keyboardEquivalent = KEY_FOR_POINTER[action.command];

    if (action.event.inputMethod === "pointer" && keyboardEquivalent !== undefined) {
      const suggestion = missed(
        "pointer-instead-of-key",
        definition.description,
        keyboardEquivalent,
        0,
        platform,
      );

      if (suggestion !== null) {
        found.push(suggestion);
      }
    }
  }

  return dedupe(found)
    .sort((left, right) => right.savedActions - left.savedActions)
    .slice(0, MAX_MISSED);
}

function sameMultiset(left: GridCommandId[], right: GridCommandId[]): boolean {
  const counts = new Map<GridCommandId, number>();

  for (const command of left) {
    counts.set(command, (counts.get(command) ?? 0) + 1);
  }

  for (const command of right) {
    const remaining = counts.get(command);

    if (remaining === undefined || remaining === 0) {
      return false;
    }

    counts.set(command, remaining - 1);
  }

  return [...counts.values()].every((count) => count === 0);
}

/**
 * Did the player walk one of the shortest routes? *Any* of them — the solver returns every route
 * tied for shortest, and a player who found the other one is not less optimal for it (§6.6).
 *
 * Steps sharing a `group` may be performed in any order (a composite's independent parts), so where
 * a route says the order is free, the comparison compares a set rather than a sequence.
 */
function matchRoute(stream: PlayerAction[], routes: Route[]): string | null {
  const played = stream.map((action) => action.command);

  for (const route of routes) {
    const steps = route.steps.filter((step) => step.optional !== true);

    if (steps.length !== played.length) {
      continue;
    }

    if (steps.every((step, index) => step.command === played[index])) {
      return route.id;
    }

    const orderFree = steps.every((step) => step.group !== undefined);

    if (orderFree && sameMultiset(steps.map((step) => step.command), played)) {
      return route.id;
    }
  }

  return null;
}

/**
 * How the player's run compares to the fastest route.
 *
 * Route quality and correctness never touch (§6.2): a player who clicked their way through still
 * completed, still scored, still banked the record. This is a separate report about *how* — and it
 * is only ever as confident as the evidence it was handed.
 */
export function compareRoute(
  events: RunEvent[],
  routes: Route[] | null,
  platform: Platform,
): RouteComparison {
  const stream = commandStream(events);
  const playerActions = stream.length;
  const route = routes?.[0] ?? null;
  const optimalActions = route?.optimalActions ?? 0;
  const keyboardActions = stream.filter((action) => action.event.inputMethod === "keyboard").length;
  const pointerActions = stream.filter((action) => action.event.inputMethod === "pointer").length;
  const shortcutActions = stream.filter((action) => action.event.via === "shortcut").length;

  // An event with no command is an action whose route contribution cannot be known. Rather than
  // infer it — the very reconstruction the command layer removed — the comparison admits it, and
  // the card shows counts instead of a route diff.
  const confidence = events.some((event) => event.command === undefined) ? "low" : "high";

  return {
    optimalActions,
    playerActions,
    extraActions: Math.max(0, playerActions - optimalActions),
    efficiency:
      playerActions === 0 || optimalActions === 0
        ? 0
        : Math.min(1, Math.max(0, optimalActions / playerActions)),
    keyboardActions,
    pointerActions,
    shortcutActions,
    keyboardShare: playerActions === 0 ? 0 : keyboardActions / playerActions,
    shortcutShare: playerActions === 0 ? 0 : shortcutActions / playerActions,
    matchedRouteId: routes === null || confidence === "low" ? null : matchRoute(stream, routes),
    missedShortcuts: confidence === "low" ? [] : detectMissedShortcuts(stream, route, platform),
    confidence,
  };
}
