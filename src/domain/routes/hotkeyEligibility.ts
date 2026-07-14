import type { Challenge } from "@/domain/challenges/challengeTypes";
import { COMMAND_REGISTRY } from "@/domain/commands/commandRegistry";
import type { Route } from "@/domain/routes/routeTypes";
import type { RunEvent } from "@/domain/runs/runTypes";
import type { HotkeyStrictness } from "@/domain/settings/themes";

/**
 * Did this run touch a pointer?
 *
 * The question is asked of the *input*, never of the action, because only the input knows. A player
 * who tabs to the Bold button and presses Enter fired `TOGGLE_BOLD` from the keyboard: the action is
 * identical to the one a click produces, and the run is keyboard-pure. Reconstructing purity from
 * the action afterwards could not tell those apart, and would lock a keyboard-only player out of a
 * keyboard-only mode for using the interface exactly as designed (§6.6).
 */
export function isKeyboardPure(events: RunEvent[]): boolean {
  return events.every((event) => event.inputMethod === "keyboard");
}

/**
 * A run that used a chord for everything. Stricter than purity, and a different question: a toolbar
 * button reached with Tab and Enter is *pure* but is not a *shortcut*, so the coaching still fires.
 */
export function isShortcutPure(events: RunEvent[]): boolean {
  return events.every((event) => event.via === "shortcut");
}

/**
 * Can this challenge be played in Hotkey Mode at all?
 *
 * A drill whose fastest route needs a step that no chord and no menu can reach is a drill the mode
 * would quietly make unwinnable. After Phase 2 there are none — every command a route can contain is
 * `hotkeyEligible`, and that phase's acceptance test proves every shipped challenge solves from the
 * keyboard. This function is what keeps that true if a future command ever arrives without a chord:
 * the drill drops out of the Hotkey queue instead of trapping the player inside it.
 */
export function isHotkeyPlayable(routes: Route[] | null): boolean {
  if (routes === null || routes.length === 0) {
    return false;
  }

  return routes.some((route) =>
    route.steps.every((step) => COMMAND_REGISTRY[step.command].hotkeyEligible),
  );
}

export type HotkeyVerdict = {
  /** May this run bank a Hotkey record? */
  ranked: boolean;
  /** Should the interface refuse pointer input outright? Only at `ranked` strictness. */
  blocksPointer: boolean;
  /** Why not, in the player's words. Null when the run is ranked. */
  reason: string | null;
};

const POINTER_USED = "This run used the pointer, so it is not a Hotkey record.";

/**
 * What each strictness level actually does (§7.4).
 *
 * `encouraged` — the default. The mode coaches; a click costs nothing but the coaching.
 * `strict`     — a run that touched the pointer banks no Hotkey record. It still plays, still
 *                grades, still scores, and still lands in the log: correctness and route quality
 *                never touch (§6.2). This is a record-book rule, not a grading one.
 * `ranked`     — the interface refuses pointer input on the grid and the toolbar, so the question
 *                cannot arise. Never the default, always reversible, and never applied outside
 *                Hotkey Mode — a mouse player must not be locked out of the rest of the game.
 */
export function hotkeyVerdict(events: RunEvent[], strictness: HotkeyStrictness): HotkeyVerdict {
  if (strictness === "encouraged") {
    return { ranked: true, blocksPointer: false, reason: null };
  }

  const pure = isKeyboardPure(events);

  // At `ranked` the pointer never reached the run, so purity holds by construction. The verdict
  // checks anyway rather than assuming it: an unenforced invariant is a bug waiting for its first
  // exception, and this one would hand out a record nobody earned.
  return {
    ranked: pure,
    blocksPointer: strictness === "ranked",
    reason: pure ? null : POINTER_USED,
  };
}

/** The Hotkey queue: only the drills a keyboard can actually finish. */
export function hotkeyPlayableChallenges<T extends Challenge>(
  candidates: T[],
  routesFor: (challenge: T) => Route[] | null,
): T[] {
  return candidates.filter((candidate) => isHotkeyPlayable(routesFor(candidate)));
}
