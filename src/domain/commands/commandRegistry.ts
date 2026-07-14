import type { Chord, CommandDefinition, GridCommandId } from "@/domain/commands/commandTypes";

type Label = { windows: string; mac: string };

/** Ctrl on Windows, Cmd on Mac — the default modifier story (DECISIONS.md:96). */
function mod(rest: string): Label {
  return { windows: `Ctrl + ${rest}`, mac: `Cmd + ${rest}` };
}

/** Ctrl on both platforms. Reserved for chords Cmd collides with at OS level (Spotlight, screenshots). */
function ctrlOnly(rest: string): Label {
  return { windows: `Ctrl + ${rest}`, mac: `Ctrl + ${rest}` };
}

/** No modifier word at all: a bare key, or one that only ever carries Shift. */
function plain(rest: string): Label {
  return { windows: rest, mac: rest };
}

type Definition = {
  id: GridCommandId;
  chords: Chord[];
  label: Label | null;
  pointerControlId?: string;
  reserved?: string;
};

/** `hotkeyEligible` follows structurally from whether a keyboard route exists — never set by hand. */
function define(entry: Definition): CommandDefinition {
  return {
    ...entry,
    hotkeyEligible: entry.chords.length > 0,
    recordable: true,
    inputVerifiable: true,
    cost: 1,
  };
}

/**
 * The one canonical registry: keyboard bindings, platform labels, pointer control identity, and
 * the solver's search-space membership all live here, so `matchChord`, `chordLabel`,
 * `resolveCommand`, the Hotkey Mode gate, and the Phase 4 solver cannot drift from one another the
 * way the hand-authored route notes already have (§1 of the plan).
 *
 * Only `OPEN_FILTER_MENU` has no input path at all yet — the menu UI ships in Phase 2. Every other
 * command below is reachable today, through the exact chord or toolbar button the shipped game
 * already has; Phase 2 adds chords to the toolbar-only entries (`FORMAT_DATE`, `SORT_ASC`,
 * `SORT_DESC`, `FILTER_TO_VALUE`, `FILTER_ABOVE_VALUE`, `CLEAR_FILTERS`), it does not add commands.
 */
export const COMMAND_REGISTRY: Record<GridCommandId, CommandDefinition> = {
  MOVE_UP: define({ id: "MOVE_UP", chords: [{ key: "ArrowUp" }], label: plain("↑") }),
  MOVE_DOWN: define({ id: "MOVE_DOWN", chords: [{ key: "ArrowDown" }], label: plain("↓") }),
  MOVE_LEFT: define({ id: "MOVE_LEFT", chords: [{ key: "ArrowLeft" }], label: plain("←") }),
  MOVE_RIGHT: define({ id: "MOVE_RIGHT", chords: [{ key: "ArrowRight" }], label: plain("→") }),

  JUMP_UP: define({ id: "JUMP_UP", chords: [{ key: "ArrowUp", mod: true }], label: mod("↑") }),
  JUMP_DOWN: define({
    id: "JUMP_DOWN",
    chords: [{ key: "ArrowDown", mod: true }],
    label: mod("↓"),
  }),
  JUMP_LEFT: define({
    id: "JUMP_LEFT",
    chords: [{ key: "ArrowLeft", mod: true }],
    label: mod("←"),
  }),
  JUMP_RIGHT: define({
    id: "JUMP_RIGHT",
    chords: [{ key: "ArrowRight", mod: true }],
    label: mod("→"),
  }),

  EXTEND_UP: define({
    id: "EXTEND_UP",
    chords: [{ key: "ArrowUp", shift: true }],
    label: plain("Shift + ↑"),
  }),
  EXTEND_DOWN: define({
    id: "EXTEND_DOWN",
    chords: [{ key: "ArrowDown", shift: true }],
    label: plain("Shift + ↓"),
  }),
  EXTEND_LEFT: define({
    id: "EXTEND_LEFT",
    chords: [{ key: "ArrowLeft", shift: true }],
    label: plain("Shift + ←"),
  }),
  EXTEND_RIGHT: define({
    id: "EXTEND_RIGHT",
    chords: [{ key: "ArrowRight", shift: true }],
    label: plain("Shift + →"),
  }),

  EXTEND_JUMP_UP: define({
    id: "EXTEND_JUMP_UP",
    chords: [{ key: "ArrowUp", mod: true, shift: true }],
    label: mod("Shift + ↑"),
  }),
  EXTEND_JUMP_DOWN: define({
    id: "EXTEND_JUMP_DOWN",
    chords: [{ key: "ArrowDown", mod: true, shift: true }],
    label: mod("Shift + ↓"),
  }),
  EXTEND_JUMP_LEFT: define({
    id: "EXTEND_JUMP_LEFT",
    chords: [{ key: "ArrowLeft", mod: true, shift: true }],
    label: mod("Shift + ←"),
  }),
  EXTEND_JUMP_RIGHT: define({
    id: "EXTEND_JUMP_RIGHT",
    chords: [{ key: "ArrowRight", mod: true, shift: true }],
    label: mod("Shift + →"),
  }),

  // Cmd+Space is Spotlight, so this chord is Ctrl-only even on macOS — an existing exception
  // (DECISIONS.md:100), not a new one.
  SELECT_COLUMN: define({
    id: "SELECT_COLUMN",
    chords: [{ key: " ", ctrl: true }],
    label: ctrlOnly("Space"),
  }),
  SELECT_ROW: define({
    id: "SELECT_ROW",
    chords: [{ key: " ", shift: true }],
    label: plain("Shift + Space"),
  }),
  SELECT_TABLE: define({ id: "SELECT_TABLE", chords: [{ key: "a", mod: true }], label: mod("A") }),

  // Keyboard-only: this one really toggles (it can unbold), which is why the toolbar's Bold
  // button — which cannot — is a separate command, APPLY_BOLD, below.
  TOGGLE_BOLD: define({ id: "TOGGLE_BOLD", chords: [{ key: "b", mod: true }], label: mod("B") }),
  // Cmd+Shift+4/5 are macOS screenshot shortcuts and never reach the browser, so the label reads
  // Ctrl on both platforms. Handling still accepts either modifier — a labelling fact, not a
  // behaviour change (the code never printed "Cmd" for these before this registry existed either).
  FORMAT_CURRENCY: define({
    id: "FORMAT_CURRENCY",
    chords: [
      { key: "$", mod: true, shift: true },
      { key: "4", mod: true, shift: true },
    ],
    label: ctrlOnly("Shift + 4"),
    pointerControlId: "toolbar-currency",
  }),
  FORMAT_PERCENT: define({
    id: "FORMAT_PERCENT",
    chords: [
      { key: "%", mod: true, shift: true },
      { key: "5", mod: true, shift: true },
    ],
    label: ctrlOnly("Shift + 5"),
    pointerControlId: "toolbar-percent",
  }),
  FORMAT_DATE: define({
    id: "FORMAT_DATE",
    chords: [],
    label: null,
    pointerControlId: "toolbar-date",
    reserved: "Bound to Ctrl+Shift+3 in Phase 2 (Ctrl only — Cmd+Shift+3 is a macOS screenshot).",
  }),

  OPEN_FILTER_MENU: define({
    id: "OPEN_FILTER_MENU",
    chords: [],
    label: null,
    reserved: "Phase 2 — the filter/sort menu UI does not exist yet.",
  }),
  SORT_ASC: define({
    id: "SORT_ASC",
    chords: [],
    label: null,
    pointerControlId: "toolbar-sort-asc",
    reserved: "Bound inside the Phase 2 filter menu.",
  }),
  SORT_DESC: define({
    id: "SORT_DESC",
    chords: [],
    label: null,
    pointerControlId: "toolbar-sort-desc",
    reserved: "Bound inside the Phase 2 filter menu.",
  }),
  FILTER_TO_VALUE: define({
    id: "FILTER_TO_VALUE",
    chords: [],
    label: null,
    pointerControlId: "toolbar-filter-equals",
    reserved: "Bound to mod+Shift+L in Phase 2.",
  }),
  FILTER_ABOVE_VALUE: define({
    id: "FILTER_ABOVE_VALUE",
    chords: [],
    label: null,
    pointerControlId: "toolbar-filter-above",
    reserved: "Bound inside the Phase 2 filter menu.",
  }),
  CLEAR_FILTERS: define({
    id: "CLEAR_FILTERS",
    chords: [],
    label: null,
    pointerControlId: "toolbar-clear-filters",
    reserved: "Bound to mod+Shift+L (toggle) in Phase 2.",
  }),

  // Toolbar-only: always sets bold on. See the comment on GridCommandId's "APPLY_BOLD" member —
  // this is not TOGGLE_BOLD's pointer equivalent, it is a genuinely different operation.
  APPLY_BOLD: define({
    id: "APPLY_BOLD",
    chords: [],
    label: null,
    pointerControlId: "toolbar-bold",
  }),

  CLICK_CELL: define({ id: "CLICK_CELL", chords: [], label: null }),
  DRAG_SELECT_RANGE: define({ id: "DRAG_SELECT_RANGE", chords: [], label: null }),
  CLICK_COLUMN_HEADER: define({ id: "CLICK_COLUMN_HEADER", chords: [], label: null }),
  CLICK_ROW_HEADER: define({ id: "CLICK_ROW_HEADER", chords: [], label: null }),
};

/** The Phase 4 solver's search space — derived, never a second hand-maintained list. */
export const KEYBOARD_COMMANDS: GridCommandId[] = Object.values(COMMAND_REGISTRY)
  .filter((definition) => definition.chords.length > 0)
  .map((definition) => definition.id);
