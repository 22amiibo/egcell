/**
 * The canonical route language. Every player input — keyboard, pointer, toolbar, menu — resolves
 * to exactly one of these before it becomes a `GridAction`, so the route a player took survives
 * even when two different commands would otherwise collapse into an identical reducer action
 * (twelve `MOVE_DOWN`s and one `EXTEND_JUMP_DOWN` can both end a run on the same cell).
 */
export type GridCommandId =
  | "MOVE_UP"
  | "MOVE_DOWN"
  | "MOVE_LEFT"
  | "MOVE_RIGHT"
  | "JUMP_UP"
  | "JUMP_DOWN"
  | "JUMP_LEFT"
  | "JUMP_RIGHT"
  | "EXTEND_UP"
  | "EXTEND_DOWN"
  | "EXTEND_LEFT"
  | "EXTEND_RIGHT"
  | "EXTEND_JUMP_UP"
  | "EXTEND_JUMP_DOWN"
  | "EXTEND_JUMP_LEFT"
  | "EXTEND_JUMP_RIGHT"
  | "SELECT_COLUMN"
  | "SELECT_ROW"
  | "SELECT_TABLE"
  | "TOGGLE_BOLD"
  | "FORMAT_CURRENCY"
  | "FORMAT_PERCENT"
  | "FORMAT_DATE"
  | "OPEN_FILTER_MENU"
  | "SORT_ASC"
  | "SORT_DESC"
  | "FILTER_TO_VALUE"
  | "FILTER_ABOVE_VALUE"
  | "CLEAR_FILTERS"
  // Pointer-origin only; never searched by the route solver.
  | "CLICK_CELL"
  | "DRAG_SELECT_RANGE"
  | "CLICK_COLUMN_HEADER"
  | "CLICK_ROW_HEADER";

/** How the player physically produced the input. Minted at the input boundary, never guessed. */
export type ActionSource = "keyboard" | "pointer" | "unknown";

/** Which surface carried it. A keyboard-activated toolbar button is `keyboard` + `toolbar`. */
export type ActionVia = "shortcut" | "grid" | "toolbar" | "menu";

export type ActionMeta = {
  command: GridCommandId;
  inputMethod: ActionSource;
  via: ActionVia;
  /** Raw keyboard evidence, e.g. "mod+shift+ArrowDown". Null for non-keyboard input. */
  chord: string | null;
  /** Raw pointer/toolbar/menu control evidence, e.g. "toolbar-bold". Null for keyboard input. */
  controlId: string | null;
};

export type Chord = {
  /** Preferred for digits and punctuation: layout-independent. */
  code?: string;
  /** Preferred for letters and named keys: a Dvorak player expects letter semantics, not position. */
  key?: string;
  /** Ctrl OR Cmd, either accepted — the default modifier story (DECISIONS.md:96). */
  mod?: boolean;
  /** Ctrl only, Cmd explicitly rejected. Reserved for chords Cmd collides with at OS level. */
  ctrl?: boolean;
  shift?: boolean;
  /**
   * Only ever required true. Left unset on every command that ships today: `matchChord` treats an
   * undeclared `alt` as unconstrained rather than requiring it up, because no shipped chord reads
   * `event.altKey` and a stricter rule would silently regress Alt-held input no test covers.
   */
  alt?: boolean;
};

export type CommandDefinition = {
  id: GridCommandId;
  /** Every chord that fires this command. Empty means no keyboard route exists yet. */
  chords: Chord[];
  /** What to show. Null mirrors `chords: []`. */
  label: { windows: string; mac: string } | null;
  /** The raw evidence for a toolbar/menu-originated command, e.g. "toolbar-bold". */
  pointerControlId?: string;
  /** Permitted in Hotkey Mode's pure-keyboard search space. Inert until Phase 4/7 consume it. */
  hotkeyEligible: boolean;
  /** Whether this command should ever be recorded as a route step. Inert until Phase 5 consumes it. */
  recordable: boolean;
  /** Whether the app can prove which input path produced this command. True for every wired path. */
  inputVerifiable: boolean;
  /** Route-cost weight for the solver. Uniform today; the solver minimises this, not just the count. */
  cost: number;
  /** Why a chord is deliberately not bound, e.g. "Alt+Left is browser back navigation". */
  reserved?: string;
};
