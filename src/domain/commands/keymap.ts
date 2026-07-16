import { COMMAND_REGISTRY, FILTER_MENU_COMMANDS } from "@/domain/commands/commandRegistry";
import type { Chord, GridCommandId } from "@/domain/commands/commandTypes";
import type { Platform } from "@/lib/platform";

/** The subset of a keyboard event `matchChord` needs. A real `KeyboardEvent` satisfies this. */
export type ChordEvent = {
  key: string;
  code?: string;
  ctrlKey: boolean;
  metaKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
};

function keyMatches(chord: Chord, event: ChordEvent): boolean {
  if (chord.code !== undefined && event.code) {
    return event.code === chord.code;
  }

  if (chord.key !== undefined) {
    return event.key.toLowerCase() === chord.key.toLowerCase();
  }

  return false;
}

/**
 * `shift` is always checked exactly, because every shipped chord already handles both the
 * shift-held and shift-up case explicitly (`SpreadsheetGrid.handleKeyDown`'s if/else on
 * `event.shiftKey`) — there is no "shift ignored" case to preserve. `alt` is the deliberate
 * exception: no chord shipping today reads `event.altKey`, so an undeclared `alt` is left
 * unconstrained rather than required up, matching today's real behaviour (Alt+Arrow still moves
 * the cursor) instead of quietly regressing it under a stricter rule no test would catch.
 */
function chordMatches(chord: Chord, event: ChordEvent): boolean {
  if (!keyMatches(chord, event)) {
    return false;
  }

  const ctrlOrMeta = event.ctrlKey || event.metaKey;

  if (chord.ctrl === true) {
    if (!event.ctrlKey || event.metaKey) {
      return false;
    }
  } else if (chord.mod === true) {
    if (!ctrlOrMeta) {
      return false;
    }
  } else if (ctrlOrMeta) {
    return false;
  }

  if (chord.shift === true) {
    if (!event.shiftKey) {
      return false;
    }
  } else if (event.shiftKey) {
    return false;
  }

  if (chord.alt === true && !event.altKey) {
    return false;
  }

  return true;
}

function chordString(chord: Chord, event: ChordEvent): string {
  const parts: string[] = [];

  if (chord.ctrl === true) {
    parts.push("ctrl");
  } else if (chord.mod === true) {
    parts.push("mod");
  }

  if (chord.shift === true) {
    parts.push("shift");
  }

  if (event.altKey) {
    parts.push("alt");
  }

  parts.push(chord.code ?? chord.key ?? event.key);

  return parts.join("+");
}

/**
 * Classifies a keydown into the command it fires, if any. Collects every chord that matches, then
 * prefers the one that explicitly constrains `alt` — otherwise-unconstrained `MOVE_DOWN` and
 * explicit `Alt+↓` (`OPEN_FILTER_MENU`) both match an Alt+ArrowDown event (§1a.2's undeclared-alt
 * rule), and the specificity check is what makes `Alt+↓` win instead of an insertion-order
 * accident. Ties among equally-specific chords fall back to registry (insertion) order, which is
 * deterministic and reproducible — no chord shipped before Phase 2 ever ties this way.
 */
export function matchChord(event: ChordEvent): { command: GridCommandId; chord: string } | null {
  let best: { command: GridCommandId; chord: string; specificity: number } | null = null;

  for (const definition of Object.values(COMMAND_REGISTRY)) {
    for (const chord of definition.chords) {
      if (!chordMatches(chord, event)) {
        continue;
      }

      const specificity = chord.alt === true ? 1 : 0;

      if (best === null || specificity > best.specificity) {
        best = { command: definition.id, chord: chordString(chord, event), specificity };
      }
    }
  }

  return best === null ? null : { command: best.command, chord: best.chord };
}

/** What to show for a command's chord on a platform. Null when no keyboard route exists yet. */
export function chordLabel(command: GridCommandId, platform: Platform): string | null {
  const label = COMMAND_REGISTRY[command].label;

  return label === null ? null : label[platform];
}

/**
 * What to press for a command, including the filter-menu fallback: a command reachable only by
 * opening the filter menu (`FILTER_MENU_COMMANDS`) has no top-level chord of its own — `label` is
 * `null` for it — but is not therefore mouse-only. Alt+↓ opens the menu, and the player chooses from
 * there (§1a.10), so this returns that two-step instruction instead of leaving the step blank and
 * implying a reach for the mouse. Extracted out of `FastestPathCard`'s original `stepChord`, which
 * the Command Codex (Task 5.3) needs verbatim: one function, not two copies that can drift apart.
 */
export function commandChordLabel(command: GridCommandId, platform: Platform): string | null {
  const direct = chordLabel(command, platform);

  if (direct !== null) {
    return direct;
  }

  if (!FILTER_MENU_COMMANDS.has(command)) {
    return null;
  }

  const open = chordLabel("OPEN_FILTER_MENU", platform);

  return open === null ? null : `${open}, then choose`;
}
