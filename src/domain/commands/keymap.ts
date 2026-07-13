import { COMMAND_REGISTRY } from "@/domain/commands/commandRegistry";
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
 * Classifies a keydown into the command it fires, if any. Iterates the registry in its own
 * (insertion) order, so which command wins a tie is deterministic and reproducible — there is no
 * tie among today's chords, but Phase 2's `Alt+↓` will need a specificity rule here, not an
 * ordering accident.
 */
export function matchChord(event: ChordEvent): { command: GridCommandId; chord: string } | null {
  for (const definition of Object.values(COMMAND_REGISTRY)) {
    for (const chord of definition.chords) {
      if (chordMatches(chord, event)) {
        return { command: definition.id, chord: chordString(chord, event) };
      }
    }
  }

  return null;
}

/** What to show for a command's chord on a platform. Null when no keyboard route exists yet. */
export function chordLabel(command: GridCommandId, platform: Platform): string | null {
  const label = COMMAND_REGISTRY[command].label;

  return label === null ? null : label[platform];
}
