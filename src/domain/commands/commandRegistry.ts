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

/**
 * `FilterMenu`'s own option list (`components/grid/FilterMenu.tsx`) — the structural source for
 * which commands are keyboard-reachable only through that menu, not a second hand-maintained list.
 * None of these has a top-level chord of its own; Excel doesn't bind "sort ascending" to a bare key
 * either, it lives in the dropdown (`Alt+↓`, `OPEN_FILTER_MENU`, is the real chord).
 */
export const FILTER_MENU_COMMANDS: ReadonlySet<GridCommandId> = new Set([
  "SORT_ASC",
  "SORT_DESC",
  "FILTER_TO_VALUE",
  "FILTER_ABOVE_VALUE",
  "CLEAR_FILTERS",
]);

/**
 * What a route step *says*, as opposed to what it presses: "Jump to the bottom of the data" rather
 * than "Ctrl + ↓". One definition, two renderings — the chord comes from `chordLabel`, resolved for
 * the player's platform (§6.4). Exhaustive by type, so a new command cannot ship without one.
 */
const DESCRIPTIONS: Record<GridCommandId, string> = {
  MOVE_UP: "Move up one cell",
  MOVE_DOWN: "Move down one cell",
  MOVE_LEFT: "Move left one cell",
  MOVE_RIGHT: "Move right one cell",

  JUMP_UP: "Jump to the top of the data",
  JUMP_DOWN: "Jump to the bottom of the data",
  JUMP_LEFT: "Jump to the left edge of the data",
  JUMP_RIGHT: "Jump to the right edge of the data",

  EXTEND_UP: "Extend the selection up",
  EXTEND_DOWN: "Extend the selection down",
  EXTEND_LEFT: "Extend the selection left",
  EXTEND_RIGHT: "Extend the selection right",

  EXTEND_JUMP_UP: "Extend the selection to the top of the data",
  EXTEND_JUMP_DOWN: "Extend the selection to the bottom of the data",
  EXTEND_JUMP_LEFT: "Extend the selection to the left edge of the data",
  EXTEND_JUMP_RIGHT: "Extend the selection to the right edge of the data",

  SELECT_COLUMN: "Select the column",
  SELECT_ROW: "Select the row",
  SELECT_TABLE: "Select the whole table",

  TOGGLE_BOLD: "Toggle bold",
  APPLY_BOLD: "Apply bold",
  FORMAT_CURRENCY: "Format as currency",
  FORMAT_PERCENT: "Format as percent",
  FORMAT_DATE: "Format as a date",

  OPEN_FILTER_MENU: "Open the sort and filter menu",
  SORT_ASC: "Sort A to Z",
  SORT_DESC: "Sort Z to A",
  FILTER_TO_VALUE: "Filter to the selected value",
  FILTER_ABOVE_VALUE: "Filter above the selected value",
  CLEAR_FILTERS: "Clear the filters",
  TOGGLE_FILTER: "Filter to the selected value, or clear the filters",

  CLICK_CELL: "Click the cell",
  DRAG_SELECT_RANGE: "Drag across the range",
  CLICK_COLUMN_HEADER: "Click the column header",
  CLICK_ROW_HEADER: "Click the row header",
};

/**
 * `hotkeyEligible` follows structurally from whether a keyboard route exists — never set by hand.
 * A route is either a top-level chord, or membership in `FILTER_MENU_COMMANDS` (reachable via
 * `Alt+↓` then arrows/Enter) — the only two ways a command is keyboard-reachable today.
 */
function define(entry: Definition): CommandDefinition {
  return {
    ...entry,
    description: DESCRIPTIONS[entry.id],
    hotkeyEligible: entry.chords.length > 0 || FILTER_MENU_COMMANDS.has(entry.id),
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
 * Every command is reachable by keyboard as of Phase 2: `FORMAT_DATE` and the new `TOGGLE_FILTER`
 * get top-level chords; `OPEN_FILTER_MENU` (`Alt+↓`) opens `FilterMenu`, which is the only route to
 * `SORT_ASC`, `SORT_DESC`, `FILTER_TO_VALUE`, `FILTER_ABOVE_VALUE`, and `CLEAR_FILTERS` — tracked in
 * `FILTER_MENU_COMMANDS` above, not a bare `chords.length > 0` check.
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
  // Cmd+Shift+3 is a macOS screenshot and never reaches the browser, same class as
  // Ctrl+Shift+4/5 below — the macOS label reads Ctrl, handling accepts either (DECISIONS.md).
  FORMAT_DATE: define({
    id: "FORMAT_DATE",
    chords: [
      { key: "#", mod: true, shift: true },
      { key: "3", mod: true, shift: true },
    ],
    label: ctrlOnly("Shift + 3"),
    pointerControlId: "toolbar-date",
  }),

  // Excel's filter dropdown. Alt+←/Alt+→ are browser history navigation and must never be bound —
  // only Alt+↓ (and only Alt+↓) gets a chord. `matchChord`'s specificity rule (keymap.ts) is what
  // lets this win over plain MOVE_DOWN, whose chord leaves `alt` unconstrained (§1a.2).
  OPEN_FILTER_MENU: define({
    id: "OPEN_FILTER_MENU",
    chords: [{ key: "ArrowDown", alt: true }],
    label: { windows: "Alt + ↓", mac: "Option + ↓" },
  }),
  // No top-level chord — reachable only inside FilterMenu (arrows to highlight, Enter to apply),
  // hence FILTER_MENU_COMMANDS above rather than `chords.length > 0` for hotkeyEligible.
  SORT_ASC: define({
    id: "SORT_ASC",
    chords: [],
    label: null,
    pointerControlId: "toolbar-sort-asc",
  }),
  SORT_DESC: define({
    id: "SORT_DESC",
    chords: [],
    label: null,
    pointerControlId: "toolbar-sort-desc",
  }),
  FILTER_TO_VALUE: define({
    id: "FILTER_TO_VALUE",
    chords: [],
    label: null,
    pointerControlId: "toolbar-filter-equals",
  }),
  FILTER_ABOVE_VALUE: define({
    id: "FILTER_ABOVE_VALUE",
    chords: [],
    label: null,
    pointerControlId: "toolbar-filter-above",
  }),
  CLEAR_FILTERS: define({
    id: "CLEAR_FILTERS",
    chords: [],
    label: null,
    pointerControlId: "toolbar-clear-filters",
  }),
  // Keyboard-only toggle, not a shared chord on FILTER_TO_VALUE/CLEAR_FILTERS — see the doc
  // comment on GridCommandId's "TOGGLE_FILTER" member and the plan's §1a.10.
  TOGGLE_FILTER: define({
    id: "TOGGLE_FILTER",
    chords: [{ key: "l", mod: true, shift: true }],
    label: mod("Shift + L"),
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

/**
 * The Phase 4 solver's search space — derived from `hotkeyEligible`, not re-derived from
 * `chords.length` a second time, so the two notions of "keyboard-reachable" cannot drift apart
 * (a command reachable only through `FilterMenu` is `hotkeyEligible` but has `chords: []`).
 */
export const KEYBOARD_COMMANDS: GridCommandId[] = Object.values(COMMAND_REGISTRY)
  .filter((definition) => definition.hotkeyEligible)
  .map((definition) => definition.id);
