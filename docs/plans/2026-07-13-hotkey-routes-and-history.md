# Hotkey Mode, Fastest Paths, Assisted Runs, and Performance History

**Status:** proposed. Nothing here is built.
**Repository HEAD at time of writing:** `311440f Anchor filters on data cells only`.
**Stance:** the current code is the source of truth. Where the tracked docs disagree with the code, the code wins and the doc is listed as stale in §2.9.

---

## 1. Executive summary

Six features were requested. They are not six features. They are one capability — *the game learns to talk about the route the player took* — plus a storage change that lets the profile show a trend instead of a list.

Everything downstream (Hotkey Mode, the fastest-path card, the Help button, the efficiency numbers, the coaching) is blocked on one missing thing: **the app records what changed on the grid, but not which command changed it.** `RunEvent` holds a `GridAction` and an `inputMethod` of `"keyboard" | "pointer"` (`src/domain/runs/runTypes.ts:9-14`). Twelve presses of `ArrowDown` and one press of `Ctrl+Shift+ArrowDown` both arrive as keyboard-flavoured actions. The route is unrecoverable. Fix that, and the other five features become straightforward.

The ten decisions that shape this plan:

1. **Introduce a semantic command layer.** Input (keydown, click, toolbar, menu) resolves to a named `GridCommandId` *before* it becomes a `GridAction`. `RunEvent` gains `command`, `via`, `chord`. This is Phase 1 and everything depends on it. The reducer, the validators, and scoring are untouched.

2. **Compute fastest paths; do not author them.** `gridReducer` is pure (`src/domain/grid/gridReducer.ts:98`) and every validator grades the grid's end state, never the route (`challengeTypes.ts:29-31`, `DECISIONS.md:195`). So the optimal keyboard route can be *derived* by breadth-first search over the ~26 keyboard commands against the real reducer, with the real validator as the goal test. There is even precedent: `eligibility.ts:149-161` already runs the validator against a `syntheticRun` to reject drills that start complete.

   **The strongest argument for this is that hand-authoring has already failed.** Every one of the 21 seeded templates and 23 classics ships exactly one authored "Fast route" note, and several are already wrong:
   - `gen.navigation.first-in-column`'s note says *"ride Ctrl+Up from below"* (`templates/navigation.ts:134`). It is off by one: the header holds text, so `hasData` is true for it, and `Ctrl+Up` from inside the column lands **on the header**, not on the first entry (`keyboardNav.ts:6-10`, `:97-104`).
   - `gen.formatting.bold-column`'s note prescribes *"click the first value, Ctrl+Shift+Down, then Ctrl+B"* (`templates/formatting.ts:236`) and misses the strictly cheaper `Ctrl+Space` → `Ctrl+B`.
   - Classic `navigation.last-status-cell` (`data/challenges/index.ts:277`) and `formatting.bold-region-column` (`:412`) are both beaten by two-key routes their own notes do not mention.

   A solver plus the test *"no authored route may be longer than the solver's optimum"* would have caught all four the day they landed. The notes rotted because a human wrote what they believed the engine did; the solver asks the engine.

3. **Complete the keyboard command set before building Hotkey Mode.** `sort-column`, `filter-column`, `clear-filters`, and the date format have **no keyboard route at all** — they are toolbar-only. That leaves **6 of 21 seeded templates and 8 of 23 classics unsolvable without the mouse** (§2.3). A "Hotkey Mode" that silently excluded the entire sort-filter and mixed families would be a lie. Phase 2 adds `Ctrl+Shift+L`, `Alt+↓` (a real filter/sort menu — which is also exactly the route in the brief's own example), and `Ctrl+Shift+3`.

4. **Hotkey Mode is a third `ChallengeMode`, surfaced as a top-level mode button.** `ChallengeMode` becomes `"main-speed" | "practice" | "hotkey"` (`challengeTypes.ts:18`). Because personal records key on `${challengeId}:${mode}` (`personalRecords.ts:7`) and run history keys on a free-form `modeKey` string (`runHistory.ts:12`), one enum value buys an isolated record book *and* an isolated graph category with no new record infrastructure. It is a modifier in mechanics, a mode in the UI.

5. **A run becomes assisted the moment help is revealed, irreversibly, and eligibility is decided in exactly one function.** `getRunEligibility()` in `src/domain/runs/runEligibility.ts` is the only place that answers "does this count". `useGameRun` calls it instead of its current inline check (`useGameRun.ts:127`).

6. **Recent Runs and the graph read one new store.** `run-history:v1` is a *derived profile blob* capped at 50 rows — display list, totals accumulator, and only history, all at once. Replace it with an append-only `run-log` of canonical `RunRecord`s. Recent Runs becomes a selector that takes 20; the graph a selector that takes everything eligible. One source of truth, two windows.

7. **The graph's categories are the six modes that already exist, plus Hotkey.** Speed, Practice, Sprint 5, Sprint 10, 30s, 60s are real playable modes today (`GameShell.tsx:38-45`) and are already the exact strings stored in `RunHistoryEntry.modeKey`. They are not parent groups. **No normalisation or migration of mode identity is needed** — the single largest piece of luck in the brief.

8. **The graph's primary metric is score, not raw time.** Score already normalises each task against *its own* `targetSeconds` (`scoreRun.ts:22`), which is exactly why seeded queues were allowed to replace fixed ones (`DECISIONS.md:65`). Raw elapsed time across a 4-second navigation drill and a 16-second three-part mixed drill (`templates/mixed.ts:104-105`) is not a trend, it is a record of what the queue drew. A lower-is-better time metric is still offered: **pace index** = `elapsedMs ÷ targetMs`, unitless, comparable across drills.

9. **No chart library.** The repo's only runtime dependencies are `next`, `react`, `react-dom`. A hand-rolled SVG line chart (~180 lines) honours that and gives full control over theme tokens, reduced motion, and the accessible fallback table.

10. **The dead `settings.scoring` category becomes the Hotkey Mode policy.** `hotkeyStrictness: "encouraged" | "strict" | "ranked"` and `mousePolicy` already exist in the `Settings` type and render in the settings UI, and **nothing reads either** (`domain/settings/themes.ts:451-504`). `hotkeyStrictness` is wired up; `mousePolicy` is deleted as a duplicate source of truth.

**Not in this plan:** accounts, servers, leaderboards, payments, classrooms, file import, native apps, AI coaching, a challenge-engine rewrite, a UI redesign. The grid engine gains four commands and one menu; nothing else about it changes.

---

## 1a. Addendum (session 2): locked route-tracking architecture and product decisions

This section records two things that changed after the plan above was written and before implementation started: the product owner's answer to the open question at the end of §13, and a tightened, locked architecture for the command/event layer that Phase 1 must follow exactly. Where this addendum's wording differs from §3–§11 above, **this addendum wins**; the sections below are updated in place where the difference is load-bearing (§3.2, §3.3, §4.2, §5.1, §5.2, §5.7, §6.3, §8.1, §8.2, §11 Phases 1/3/7, §13), and the rest of the original text stands.

### 1a.1 Resolved: the Practice open question

**Correction (this replaces an earlier, wrong draft of this section — see the note at the end).** **Decision: Practice remains an ordinary record-eligible mode. There is no `Learn` mode. Help stays inside Practice, and assistance — not mode identity — is what unranks a run.**

- Practice remains a fully playable, fully graphed mode — the same challenge picker, the same generated templates and classics, the same five difficulties. Nothing about *what Practice offers* changes. (Verified: `GameShell.tsx`'s single-selection dropdown already lists every classic and every generated template for both Speed and Practice from the same `challenges`/`generatedTemplates` arrays, `GameShell.tsx:238-251` — Practice was never a restricted subset, so "make sure all variants are offered" is already true today and needs no code change.)
- **A Practice run with help never revealed is an ordinary record-eligible run**, exactly like Speed: it may set a Practice personal best and is fully counted in Practice's performance statistics. `ChallengeMode`, the PR type guard (`personalRecords.ts:60`), and every existing Practice record are **untouched** by this plan. Practice's record book is not retired, killed, or special-cased in any way.
- **Assistance, not mode, is what unranks a run.** The instant help is revealed — in *any* mode, Practice included — that run's `assist` flips to `"revealed"` and stays that way for the attempt (§3.2, unchanged). `getRunEligibility` applies the same rules to a Practice run as to a Speed run: rule 2 (`assist === "revealed"` → PB/stats/leaderboard `false`) is what excludes an assisted Practice run from Practice's PB book and performance graph — there is no separate, mode-keyed rule, and none is needed (§1a.4 below).
- `settings.help.autoRevealInPractice` (default `false`): when on, a Practice run **starts** already assisted — the panel is visible from the first render, no confirmation step is needed (nothing has been revealed mid-run to confirm), and the run is unranked from the start via the same `assist === "revealed"` rule as any other assisted run. Turning the setting off restores ordinary record-eligible Practice runs. This is a per-run starting condition, not a change to what Practice *is*.
- Assisted runs (Practice or otherwise) still appear in Recent Runs with an `Assisted` badge and no official time (§3.3, unchanged), and are still excluded from PBs and the performance graph (§8.1's classification matrix, unchanged) — never deleted, never hidden from the practice-activity count.
- No `Learn` mode is introduced. Practice already is the always-available, help-permitting surface the brief asked for; a Practice run simply keeps its existing record eligibility whenever the player doesn't ask for help.

**Why this section changed.** An earlier pass of this addendum misread "kill practice mode PB book" as "Practice never banks a PB, ever" and, from that, retired the whole record book, added a mode-keyed eligibility rule, dropped `"practice"` from the PR type guard, and rewrote the Help confirmation and `autoRevealInPractice` sections around a Practice that could never be ranked. None of that is correct: the approved behavior is that Practice is ordinary and record-eligible until a specific run is assisted, exactly like every other mode. That draft's downstream changes (§1a.4's Practice-specific rule, the Phase 7 PR-type-guard rewrite, the Help-confirmation carve-out, and the closing "resolved" note at the end of §13) are corrected in place below, back to the original design's shape, with this section as the record of why.

### 1a.2 The three-layer event model, made explicit

The plan already separated these conceptually; this addendum names them so Phase 1's code has to keep them separate on purpose, not by accident:

1. **Raw input evidence** — the literal key chord (`"mod+shift+ArrowDown"`) or the literal control that was activated (`"toolbar-bold"`). Debugging and platform-verification information only; never used for route comparison directly.
2. **Semantic command** — `GridCommandId`. The canonical route language. Two raw inputs that mean the same thing (`Ctrl+B` and `Cmd+B`; a keyboard-activated toolbar button and a mouse-clicked one) resolve to the same command.
3. **Reducer action** — `GridAction`. Unchanged, grid-only, carries no route information once dispatched.

`ActionMeta` (§5.1) is revised to carry evidence from **both** layer 1 forms, not just the keyboard one:

```ts
export type ActionSource = "keyboard" | "pointer" | "unknown";
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
```

**`"unknown"` is added to `ActionSource`.** Every input path Phase 1 wires (keyboard chord, grid pointer, toolbar button) mints its origin with certainty at the point of input, so no *live* call site ever produces `"unknown"` — every real Phase 1 event is `"keyboard"` or `"pointer"`, exactly as today. `"unknown"` exists so that a future or malformed source (a corrupted persisted event, a replay stream from a path the app does not own) has an honest value to fall back to instead of being coerced into `"keyboard"` or `"pointer"` by a default parameter. This is the concrete answer to *"do not falsely mark unknown commands as verified keyboard actions"*: the type makes the false-positive state unrepresentable by silent default. `RunEvent.inputMethod`'s type (`RunInputMethod`) widens to match, for the same reason; existing values are unaffected.

**The command is bound to the action atomically, at the dispatch call site, before the reducer discards the distinguishing information.** This satisfies "record the route at the command-execution boundary, before or at the same time the action is dispatched" without reordering `useGameRun.dispatch`'s existing fold-then-append-then-validate sequence: `resolveCommand` produces the `GridAction` *from* the command (not the other way around), so the command is never reconstructed after the fact — it is the input the action was derived from. The two are inseparable from the first line of `dispatch` onward.

**No full grid snapshot is recorded per command.** Checked against the repository: `RunEvent` today holds only `{atMs, action, inputMethod}`; nothing anywhere serialises the grid. Phase 1 adds `command`/`via`/`chord`/`controlId` — all small, bounded strings — and nothing else. The BFS solver's canonical-grid-signature hash (§6.3) is computed in memory during search and is never persisted to a `RunEvent`; it has no relationship to event storage at all.

### 1a.3 One canonical registry, not a keymap plus a separate catalog

§4.2 originally listed `keymap.ts` (bindings + labels) and `commandCatalog.ts` (the solver's search space) as two files with two pieces of data. **That is a duplicate source of truth and is corrected here.** The data lives in exactly one place:

```
src/domain/commands/commandTypes.ts     GridCommandId, ActionSource, ActionVia, ActionMeta, Chord, CommandDefinition — types only, no data
src/domain/commands/commandRegistry.ts  COMMAND_REGISTRY: Record<GridCommandId, CommandDefinition> — THE data
src/domain/commands/keymap.ts           matchChord(event), chordLabel(command, platform) — pure functions reading the registry
src/domain/commands/resolveCommand.ts   CommandContext, resolveCommand(command, context) → GridAction | null
```

`commandCatalog.ts` is dropped from the file list; `KEYBOARD_COMMANDS` for the Phase 4 solver becomes `Object.values(COMMAND_REGISTRY).filter(c => c.chords.length > 0)` — derived, not a second list that can drift from the registry.

```ts
// src/domain/commands/commandTypes.ts
export type Chord = {
  code?: string;   // layout-independent: digits, punctuation
  key?: string;    // semantic: letters
  /** Ctrl OR Cmd, either accepted — the default modifier story (DECISIONS.md:96). */
  mod?: boolean;
  /** Ctrl only, Cmd explicitly rejected — reserved for the three chords Cmd collides with at OS level (Ctrl+Space; later Ctrl+Shift+3/4/5). */
  ctrl?: boolean;
  shift?: boolean;
  /** Only ever required true. Left unset on every Phase 1 chord — see the matching-rule note below. */
  alt?: boolean;
};

export type CommandDefinition = {
  id: GridCommandId;
  chords: Chord[];                          // empty = no keyboard route yet
  label: { windows: string; mac: string } | null;  // null mirrors chords: []
  pointerControlId?: string;                // e.g. "toolbar-bold"; the raw evidence for via: "toolbar"
  /** Permitted in Hotkey Mode's pure-keyboard search space. Consumed starting Phase 4/7; honestly populated now, inert until then. */
  hotkeyEligible: boolean;
  /** Whether this command should ever be recorded as a route step. True for every Phase 1 command; no consumer discriminates on it yet. */
  recordable: boolean;
  /** Whether the app can prove which input path produced this command. True for every Phase 1 entry — every wired path mints origin with certainty. */
  inputVerifiable: boolean;
  /** Route-cost weight for the solver. Uniform (1) in Phase 1 by design (see 1a.5) — not yet consumed. */
  cost: number;
  /** Why a chord is deliberately NOT bound, e.g. "Alt+Left is browser back navigation". */
  reserved?: string;
};
```

**Chord-matching rule, stated precisely (this is new — the original plan did not specify it and an ambiguous version would silently regress Alt-held input):** a chord matches an event when every modifier it *declares* matches exactly, and modifiers it does not declare are unconstrained, **except** `shift`, which is always checked exactly (declared-false and undeclared are both "must be up") because every existing branch of `SpreadsheetGrid.handleKeyDown` already handles both the shift and no-shift case explicitly — there is no "shift ignored" branch to preserve. `alt` is deliberately the odd one out: none of the nine chords shipping today constrain it (`handleKeyDown` never reads `event.altKey`), so Phase 1's registry entries leave `alt` undeclared, and the matcher does not require it to be up. This preserves today's real, if accidental, behaviour (Alt+Arrow still moves the cursor) instead of quietly regressing it under a stricter rule that no test happens to cover. When Phase 2 adds `Alt+↓` for the filter menu, a chord that explicitly requires `alt: true` will start existing alongside chords that don't care about `alt` at all — at that point `matchChord` needs a specificity rule (a chord that constrains more modifiers wins a tie) so `Alt+↓` doesn't also satisfy plain `MOVE_DOWN`. That rule is out of scope for Phase 1 (no Phase 1 chord sets `alt: true`, so no ambiguity can occur yet) and is called out as a Phase 2 task below.

### 1a.4 `getRunEligibility`, confirmed unchanged from §5.6

**Correction:** an earlier draft of this section inserted a `modeKey === "practice" → countsForPersonalBest: false` rule here. That rule is wrong and has been removed (§1a.1) — eligibility is derived from the run's own state (`assist`, `outcome`, `integrity`, `schemaVersion`), never from which mode it was played in. `getRunEligibility` needs no changes from §5.6's original rule list, restated here for completeness since §5.6 pointed forward to this section:

1. `integrity === "suspect"` → everything `false`. Still stored, for audit.
2. `assist === "revealed"` → PB, stats, leaderboard `false`; recent, practice `true`. **This is the only rule that unranks a Practice run** — the same rule that unranks any other mode's assisted run.
3. `outcome !== "completed"` → PB, stats, leaderboard `false`; recent `true` (labelled), practice `true`.
4. `schemaVersion === 1` (migrated legacy) → PB `false`; stats `true`; recent `true`; practice `true`.
5. Otherwise → everything `true`. **This includes an unassisted, completed Practice run** — it may set a Practice PB exactly like Speed.
6. Otherwise → everything `true`.

Purity (Hotkey) is still handled outside this function, unchanged from §5.6.

### 1a.5 Route cost: count and weight, kept as two distinct fields

§5.7's `Route` type gains a cost field alongside the existing action count, and the architecture must not assume the two ever collapse into one number:

```ts
export type RouteStep = {
  command: GridCommandId;
  label: string;
  argument?: string;
  optional?: boolean;
  group?: string;
  /** This step's weight, read from the command registry at solve time. 1 in Phase 1/4's first cut. */
  cost: number;
};

export type Route = {
  // ...unchanged fields from §5.7...
  optimalActions: number;   // count: steps.filter(s => !s.optional).length
  optimalCost: number;      // weight: sum of non-optional steps' cost
};
```

**Phase 4 solves for minimum cost, not minimum count**, with every `CommandDefinition.cost` fixed at `1` — so minimum-cost and minimum-count coincide exactly and today's BFS-over-unweighted-edges is simultaneously "the cost-weighted solver with uniform weights," not a shortcut that a later weight change would have to replace. `optimalActions` and `optimalCost` are computed and displayed as the same number in Phase 4/5, but as two fields from day one, so introducing a real weight later (e.g., a menu-driven command costing more than a direct chord) is a data change (`cost: 2` on one registry entry) and not a solver rewrite or a `RunRecord`/`RouteComparison` schema change. Neither field is consumed before Phase 4; this addendum fixes the shape now so Phase 4 does not have to widen it later.

**Solver safeguards, made explicit** (§6.3 already had budgets and a visited set; this names the remaining ones so Phase 4's task list can check them off): bounded search depth and node count (already specified); a canonical-signature visited set, which **is** the cycle-detection mechanism — a state already seen is never re-queued; **deterministic command iteration order**, fixed by the registry's own key order (an `Object.values(COMMAND_REGISTRY)` iteration, not a `Set` or object-key order that could vary), so that when two routes tie for shortest, which one the solver returns first is reproducible across runs and machines; a timeout is not separately needed given the node budget already bounds wall-clock work, but the **failure mode is `null`, never a partial or best-effort route** — a caller that gets `null` must show "no fastest path is recorded for this drill," never a route that might not actually solve the challenge; the cache key `${challenge.id}:${challenge.seed}` already carries challenge-version awareness because `challenge.id` embeds `templateVersion` (§8.2).

### 1a.6 Hotkey-capability requirement, restated as a test obligation

Unchanged in substance from §2.3/§11 Phase 2, restated as an explicit gate so it cannot be waved through by inspection alone: **no challenge or template is marked `keyboardComplete` until an automated test replays a command sequence built only from `hotkeyEligible: true` commands through the real reducer and the real validator and asserts completion.** A template is Hotkey-eligible because a test proves a keyboard-only solve exists, never because someone judged its `allowedActions` list looks keyboard-shaped.

### 1a.7 Phase-order note

The user-supplied dependency chain for this session (registry → rich event recording → missing commands → solver → assisted help → fastest-path feedback → Hotkey Mode → history/graph) is followed **except** for one deliberate inversion already present in the original plan: **Phase 5 (fastest path in results) stays before Phase 6 (help and assisted runs)**, not after. Reason: the Help panel's content (§7.2) is explicitly specified as "the post-run card minus the comparison rows" — it reuses `FastestPathCard`/`useFastestPath` from Phase 5. Building Phase 6 first would mean building the panel twice. Phase 6's own dependency line already said `Phases 3, 4, 5`; this addendum makes explicit that the ordering is intentional, not an oversight, so a future implementer does not "fix" it back to the chain's literal order. Phase 3 (run model, log, eligibility, migration) is unaffected by the chain and keeps its position between Phases 2 and 4 — it has no dependency on the solver and nothing in the chain requires it to move.

### 1a.8 Phase 1 acceptance criterion, corrected

§11 Phase 1 originally stated the acceptance criterion as "the existing 493 tests are green," implying zero test-file edits. That is not achievable and should not be attempted: changing `dispatch`'s and `onAction`'s second parameter from a bare `RunInputMethod` string to a full `ActionMeta` object is the entire point of the phase, and roughly two dozen assertions of the shape `toHaveBeenCalledWith(action, "keyboard")` structurally cannot survive that unedited. Deleting `shortcutLabelForEvent` likewise changes one rendered label in one existing test. The corrected criterion:

> All existing tests pass. Test files whose assertions describe the second argument to `onAction`/`dispatch`, or the label `shortcutLabelForEvent` produced, are intentionally migrated to assert the richer shape or label — same behaviour, same coverage, updated expected values. No assertion is deleted, weakened, or replaced with a looser matcher (`expect.anything()`) to make the migration pass. Every other test is untouched. The digest test is migrated the same way, for the same reason (`eventDigest`'s canonical form gains `command`, per §4.3).

### 1a.9 Correction: `APPLY_BOLD` is not `TOGGLE_BOLD`

**The toolbar's Bold button and the `Ctrl/Cmd+B` shortcut are not the same operation and must not share a command id.** An earlier implementation pass tagged both `via: "toolbar"` and `via: "shortcut"` bold actions as `TOGGLE_BOLD`, on the reasoning that they were "the same command, different surface" (§1a.2's general principle). They are not: the toolbar button always sets `format: { bold: true }` regardless of the selection's current state (`Toolbar.tsx:83`, unchanged since before this plan), while `Ctrl/Cmd+B` genuinely toggles — `format: { bold: !isRangeBold(grid, bounds) } }` — and unbolds an all-bold selection. This is not cosmetic: it is the reason `formatting.unbold-header` has **no mouse-only solve** (§7.5, §12 risk 5) — the toolbar cannot produce the one action that would unbold it. Recording both under `TOGGLE_BOLD` would mean the recorded command lies about which action a replay of it produces, breaking exactly the guarantee `resolveCommand` exists to provide (§1a.2: "the command is bound to the action atomically... never reconstructed after the fact").

**Fix: a second command, `APPLY_BOLD`,** for the toolbar's button. `GridCommandId` gains it (§5.1, corrected above); it has no chord (`chords: []`, toolbar-only, matching `FORMAT_DATE`'s shape), `pointerControlId: "toolbar-bold"`, and — because it has no keyboard route — `hotkeyEligible: false` and it is never a member of `KEYBOARD_COMMANDS`, so the Phase 4 solver never has to choose between an apply-only and a toggling bold: it only ever searches `TOGGLE_BOLD`, the one that can reach every reachable state, including unbolding. `TOGGLE_BOLD` keeps its existing chord and keeps `pointerControlId` unset (no pointer path produces it now). `resolveCommand("APPLY_BOLD", context)` returns the same `bounds === null ? null : {kind:"set-format", range:bounds, format:{bold:true}}` the toolbar button already produces; `resolveCommand("TOGGLE_BOLD", context)` is unchanged. Because both go through `resolveCommand`, a future solver or replay reproduces exactly the state each command actually produces, from any grid — the "future solver execution reaches the same state as the original action" property holds by construction, not by a special case in the toolbar component.

§11 Phase 1 changes: the toolbar's Bold button routes through the ordinary `emit(command, controlId)` helper like every other toolbar button (no special-cased bypass), calling `emit("APPLY_BOLD", "toolbar-bold")`. The acceptance line below is corrected to say so.

### 1a.10 Phase 2: `TOGGLE_FILTER`, and widening `hotkeyEligible` to menu-reachable commands

**`TOGGLE_FILTER` is a new command, not a shared chord on two existing ones.** §5.2's table describes `mod+Shift+L` as firing `CLEAR_FILTERS` when filters exist and `FILTER_TO_VALUE` otherwise — read literally, that would mean binding one chord to two different `chords` arrays and picking between them at match time, which `matchChord` cannot do (it never reads grid state; §1a.2 keeps it that way deliberately). Instead `mod+Shift+L` fires exactly one command, `TOGGLE_FILTER`, keyboard-only (`chords: [{ key: "l", mod: true, shift: true }]`), and `resolveCommand` — which does have `context.grid` — branches on `grid.filters.length` to decide whether the resolved action is `clear-filters` or `filter-column`. This is the same shape as `TOGGLE_BOLD` (§1a.9's sibling, not its violation): one physical input, one command id, a state-dependent resolved action, fully reproducible by `resolveCommand` from the same context every time. It is distinct from `FILTER_TO_VALUE` and `CLEAR_FILTERS` the same way `TOGGLE_BOLD` is distinct from `APPLY_BOLD` — those two command ids remain the ones the toolbar and `FilterMenu` (below) use, each unconditional; `TOGGLE_FILTER` is the keyboard-only toggle layered on top.

**`hotkeyEligible` stays derived, but the derivation widens.** Phase 1 defined it as `chords.length > 0`, never hand-set (§1a of the original plan). Phase 2 introduces `FilterMenu` — reachable by `Alt+↓` (a real chord, `OPEN_FILTER_MENU`) and then `↑`/`↓`/`Enter` inside it — as the *only* keyboard route for `SORT_ASC`, `SORT_DESC`, `FILTER_TO_VALUE`, and `FILTER_ABOVE_VALUE` (`CLEAR_FILTERS` also gets a route this way, alongside `TOGGLE_FILTER`'s direct chord). None of those four has, or needs, a top-level chord of its own — Excel doesn't bind "sort ascending" to a bare key either, it lives in the dropdown. If `hotkeyEligible` stayed `chords.length > 0` unmodified, those four would read `false` forever, and §1a.6's acceptance test — "replays a command sequence built only from `hotkeyEligible: true` commands" — could never mark the sort-filter family `keyboardComplete`, defeating the entire point of this phase. The fix keeps the field derived, not hand-set, by widening what it's derived *from*: `commandRegistry.ts` exports `FILTER_MENU_COMMANDS`, the literal list of the five commands `FilterMenu` offers (the same list `FilterMenu` itself renders from — one structural source, not a second hand-maintained list), and `define()` computes `hotkeyEligible: chords.length > 0 || FILTER_MENU_COMMANDS.has(id)`. `KEYBOARD_COMMANDS` (the Phase 4 solver's search space) is updated to filter on `hotkeyEligible` directly rather than re-deriving from `chords.length` a second time, so the two notions of "keyboard-reachable" cannot drift apart the way the hand-authored route notes already have.

**`FilterMenu` has no focus or keydown handling of its own.** `SpreadsheetGrid`'s existing `handleKeyDown` — the grid's own DOM focus never moves — intercepts `↑`/`↓`/`Enter`/`Escape` while the menu is open and updates a local highlighted-index/open-state pair; the menu itself is a presentational listbox reflecting that state. "Focus returns to the grid after every menu command" holds trivially because focus never left it. Only the toolbar (a separate, native-`<button>`-focusing surface) needs an explicit refocus after `emit`, via a `gridFocusRef` prop wired through `ChallengeRun`/`SessionRun` into `SpreadsheetGrid`'s existing (previously unused) `focusRef` prop.

**`FORMAT_DATE` matches its siblings.** §5.2 said "Ctrl only"; read against `FORMAT_CURRENCY`/`FORMAT_PERCENT` — the identical macOS-screenshot class — "Ctrl only" describes the **label**, not the handling: both existing siblings accept `mod` (Ctrl or Cmd) and only *display* `Ctrl` on macOS, because the OS eats `Cmd+Shift+3/4/5` before the page ever sees it, so accepting `mod` costs nothing and stays consistent. `FORMAT_DATE` ships the same way — `chords: [{ key: "#", mod: true, shift: true }, { key: "3", mod: true, shift: true }]`, `ctrlOnly("Shift + 3")` label — rather than introducing a third, differently-handled pattern among three siblings that all hit the same OS collision.

### 1a.11 Phase 3 addendum: four small reconciliations

**`getRunEligibility` takes the fields it reads, not a whole `RunRecord`.** §5.6 types it `getRunEligibility(run: RunRecord)`, and §5.6's own `useGameRun` snippet then calls it *before a `RunRecord` exists* — the PB gate runs inside `buildFinished`, which knows the validation and the mode but not the record's id, timestamp, label, or route fields. Rather than fabricate a half-record to satisfy a type, the signature becomes `getRunEligibility(run: RunEligibilityInput)`, where `RunEligibilityInput = Pick<RunRecord, "schemaVersion" | "assist" | "outcome" | "integrity">` — exactly the four fields the five rules read, and nothing else. A `RunRecord` structurally satisfies it, so every call site §5.6 imagined still compiles unchanged. This is a narrowing of the input, not a change to the policy: the rules, their order, and their outputs are as §5.6/§1a.4 state them, and the function still cannot see `modeKey`, which is the property that matters (§1a.1).

**`domain/stats/categories.ts` ships in Phase 3 with the registry only; `METRICS` lands in Phase 9.** Phase 3 must denormalise `categoryId` at write time (§5.4), which needs `PerformanceCategoryId` and the `modeKey → category` mapping to exist. It does not need `METRICS`, whose `value(run)` projections read route fields that are null until Phase 5 and are consumed by nothing until the Phase 9 chart. The file is created now with `PERFORMANCE_CATEGORIES` and `categoryIdForMode`; `METRICS` is appended to the same file in Phase 9. §5.8's shape is otherwise unchanged, and the disjointness test it calls for ships now, with the registry it tests.

**`ProfilePanel` keeps its 50-row list through Phase 3.** §5.5 fixes `RECENT_RUNS_LIMIT` at 20 and requires the cap live in the selector, and Phase 8's `RecentRuns` component is what consumes it (with the "latest 20 of N" footer). Phase 3's acceptance is that *the profile page renders identically from a different store* — so Phase 3's `ProfilePanel` passes an explicit limit of `HISTORY_LIMIT` (50, the v1 cap it renders today) to `selectRecentRuns`, and Phase 8 drops that argument when the real component arrives. `selectRecentRuns`'s default stays 20 and is tested at 20, as specified. The alternative — silently cutting the visible list from 50 rows to 20 in a phase whose stated acceptance is "renders identically" — would make the acceptance criterion a lie.

**The migration must carry v1's `byMode` forward too, not just its totals — §9.5 step 3 is incomplete.** §9.5 preserves `totalRuns`/`totalTasksCompleted` past the 50-cap, and stops there. But v1's `byMode` has exactly the same property and for exactly the same reason: `recordRun` folded each run's best score and best time into `byMode` *before* trimming the entry list (`runHistory.ts:45-74`), so a best set by a run the cap later destroyed still stands in the aggregate and **cannot be recovered from the rows that survived**. A migration that rebuilds the profile's "bests by mode" table from the imported rows alone therefore takes a record away from the player — a player with nine Speed runs whose best scored 1450 would open the upgraded profile and find 980. So the log gains `priorByMode: Record<string, ProfileModeStats>`, populated by the migration with v1's aggregates and with each mode's run count reduced by the rows the migration imported (so the counts do not double, exactly as `priorTotals` does), and `selectByMode` folds the log's runs on top of it. This was caught by the existing `profilePanel.test.tsx`, which seeds precisely that shape; it is a genuine gap in the plan, not in the test.

**`outcome` and `completed` are not the same question, and sessions prove it.** `RunOutcome` answers *did this run reach its natural end and get graded* — the thing eligibility rule 3 keys on. `completed` answers *was every task in it finished*, which is what the profile's per-mode stats already mean today. A sprint the player skipped through finished normally and earned a real score: it is `outcome: "completed"`, `completed: false`, and it belongs on the performance graph. A timed session that ran its clock out is likewise `outcome: "completed"` — expiry *is* how a timed session ends. In Phase 3 nothing writes `"failed"` or `"expired"` yet, because the only two write sites (a finished single challenge, a finished session) are both natural ends; rule 3 becomes reachable in Phase 6/7, when an abandoned run is logged for the first time. The field exists now so the schema never has to change to accommodate it.

## 2. Current-state findings

### 2.1 Stack

| Fact | Where |
|---|---|
| Next 16 App Router, React 19, TypeScript, Tailwind 4 | `package.json` |
| Runtime dependencies: **`next`, `react`, `react-dom`. That is all.** | `package.json:14-18` |
| Vitest + jsdom + Testing Library, co-located `*.test.ts(x)` | `vitest.config.ts:12-18` |
| Playwright, Chromium only, `baseURL: http://localhost:3000` (never `127.0.0.1` — Next blocks its own chunks cross-origin) | `playwright.config.ts:6` |
| **No accounts, no server, no database, no API routes.** All data is device-local. | `CURRENT_STATE.md:81` |
| Routes: `/`, `/profile`, `/settings`, `/leaderboard` | `src/app/*/page.tsx` |
| Client state read through `useSyncExternalStore` module stores, never from effects | `DECISIONS.md:284` |

### 2.2 The run loop

`useGameRun` (`src/hooks/useGameRun.ts:72`) owns one run of one challenge.

- The clock starts when the **grid appears**, not on the first action (`hooks/runClock.ts:13`, `DECISIONS.md:268`). **Consequence for this plan: no action can precede the clock, so "actions before the timer started" is not a case that exists.**
- `dispatch(action, inputMethod)` (`:161`) folds the action through `gridReducer`, drops no-ops (the reducer returns the same object, `:174`), appends a `RunEvent`, re-validates, and finishes the instant `validation.isComplete` flips.
- `finishNow()` (`:214`) grades whatever is on the grid — sessions use it for skip and for the buzzer.
- PB banking is gated inline: `recordPersonalBest && isPersonalRecordEligible(challenge, validation)` (`:127`). **This is the check the eligibility policy replaces.**
- Every finished run builds a `RunResult` (`domain/runs/runResult.ts:15`) with full `replayEvents` and an `eventDigest`. Nothing is persisted; nothing is sent (a test asserts `fetch` is called zero times).

### 2.3 The grid engine — and the Hotkey blocker

Eight `GridAction` kinds (`domain/grid/gridTypes.ts:66-85`). The **only** key handler in the game surface is `SpreadsheetGrid.handleKeyDown` (`components/grid/SpreadsheetGrid.tsx:175-286`); a repo-wide grep for other `keydown` listeners finds only the leaderboard's tablist.

Shipped chords (`mod = metaKey || ctrlKey`, `:182`):

| Chord | Action |
|---|---|
| Arrows | `select-cell` via `stepActive` |
| `mod` + Arrows | `select-cell` via `jumpActive` (Excel's data-region jump) |
| `Shift` + either | `select-range` (extend) |
| `Ctrl+Space` | `select-column`, `usedRangeOnly: true` |
| `Shift+Space` | `select-row` |
| `mod+A` | `select-range` over the used range |
| `mod+B` | `set-format` bold **toggle** |
| `mod+Shift+4` / `$` | currency |
| `mod+Shift+5` / `%` | percent |

**Not reachable by keyboard at all: `sort-column`, `filter-column`, `clear-filters`, and `numberFormat: "date"`.** All four exist only as toolbar buttons (`components/game/Toolbar.tsx:104-181`).

That leaves these unsolvable without the mouse (or a Tab-walk to the toolbar):

- **Seeded — 6 of 21:** `gen.formatting.date`, `gen.sort-filter.sort-numeric`, `gen.sort-filter.sort-text`, `gen.sort-filter.filter-equals`, `gen.sort-filter.filter-above`, `gen.mixed.sort-and-format`.
- **Classics — 8 of 23:** `sort-filter.revenue-high-to-low`, `.east-region`, `.units-low-to-high`, `.rep-a-to-z`, `.status-complete`, `.units-above-bruno`, `mixed.sort-and-bold`, `mixed.filter-east-currency`.

Four further engine facts the route system must model, all of which a solver gets right for free and a human author gets wrong:

1. **The header counts as data for jumps.** It holds text, so `hasData` is true (`keyboardNav.ts:6-10`). `Ctrl+Down` from a header rides to the last data row; **`Ctrl+Up` from inside a column overshoots the first entry and lands on the header.** This is the bug in the shipped `first-in-column` note.
2. **`Ctrl+Space` and `Shift+Space` clobber `activeCell`** — the reducer sets `{row: 0, col}` and `{row, col: 0}` respectively (`gridReducer.ts:133,145`). The **toolbar reads `grid.activeCell`** for sort and filter (`Toolbar.tsx:123,148`), so a `Ctrl+Space` immediately before a filter click lands the anchor on the header row and **disables the Filter button** (`Toolbar.tsx:59-68`, and commit `311440f` hardened exactly this).
3. **Toolbar clicks steal DOM focus.** The buttons are native `<button>`s rendered after the grid (`ChallengeRun.tsx:86` vs `:118`), so grid hotkeys go dead until the grid is refocused. Any hybrid route must do keyboard work *first*. **Phase 2 fixes this by returning focus to the grid after a toolbar command.**
4. **Difficulty 4-5 offset the table** (`difficulty.ts:25-76`, `tableOffset: true`), so A1 is outside it and `Ctrl+Arrow` from A1 sees only blanks and shoots to the grid edge (`keyboardNav.ts:113-114`). Routes differ by difficulty. A per-difficulty authored note would be four notes; a solver is one function.

`Cmd` and `Ctrl` are both accepted with **no platform sniffing** (`DECISIONS.md:96`), with one existing single-modifier exception (`Ctrl+Space`, because `Cmd+Space` is Spotlight).

**Latent bug worth naming:** `Cmd+Shift+4` and `Cmd+Shift+5` are macOS *screenshot* shortcuts, and the grid accepts `meta || ctrl` for both. A Mac player pressing the labelled chord takes a screenshot. The fix is presentational — the macOS *label* must read `Ctrl` — and it is impossible today because there is no platform-aware label layer. §6.5.

### 2.4 Validation — and why the solver is possible

`validateChallenge` dispatches on `challenge.validation.kind`, never on an id (`validation/validateChallenge.ts:15`). `ValidationInput` carries a `run`, and **no validator reads it.** The apparent exception — `validateSortFilter`'s latch, verbatim at `validateSortFilter.ts:62-66`:

```ts
// An untouched table can already satisfy a sort by luck. Requiring at least one action stops a
// challenge completing before the player has done anything.
if (grid.sortState === null && grid.filters.length === 0) {
  return failed("Nothing has been sorted or filtered yet.");
}
```

— reads `grid.sortState` and `grid.filters`, which are **grid state, not run history**.

So `(challenge, grid) → isComplete` is a pure, cheap goal test and `(grid, command) → grid` is a pure transition. That is a search problem. `eligibility.ts:149-161` already exploits it, running the validator against a `syntheticRun` to reject variants that start complete. §6.3 does the same thing, one step further.

### 2.5 Challenges, templates, variants

- 21 seeded templates across five families, 23 hand-authored classics (`data/challenges/generated.ts:13`, `data/challenges/index.ts`). The `formula` family is declared and empty.
- A variant **is** a `Challenge` (`variantTypes.ts:40`) — everything downstream consumes the type it already knew.
- **Records key to the drill, not the seed:** `variant.id = ${templateId}@${templateVersion}:d${difficulty}` (`templates/shared.ts:89`, `DECISIONS.md:50`). **A template version bump therefore starts a new record book on purpose** — which is the challenge-version comparability rule the brief asks for, already solved.
- `checkVariant` gates every generated variant with 13 named eligibility checks (`challenges/eligibility.ts:168-386`), including `starts-complete`, `prompt-misdirection`, and `by-name-ambiguous`. Any new constraint (e.g. "has a keyboard route") belongs in that family of checks or in the queue filter, not scattered.
- `ValidationSpec` is four leaf kinds plus a flat `composite` that holds leaves only and can never nest (`challengeTypes.ts:59-70`).

### 2.6 Modes, records, sessions

The six playable modes live in one array (`components/game/GameShell.tsx:38-45`):

```ts
{ key: "speed",     label: "Speed",     selection: { kind: "single",  mode: "main-speed" } },
{ key: "practice",  label: "Practice",  selection: { kind: "single",  mode: "practice"  } },
{ key: "sprint-5",  label: "Sprint 5",  selection: { kind: "session", mode: "sprint-5"  } },
{ key: "sprint-10", label: "Sprint 10", selection: { kind: "session", mode: "sprint-10" } },
{ key: "timed-30",  label: "30s",       selection: { kind: "session", mode: "timed-30"  } },
{ key: "timed-60",  label: "60s",       selection: { kind: "session", mode: "timed-60"  } },
```

**These are the brief's six categories, one for one.** Speed and Practice are real playable modes (`ChallengeMode = "main-speed" | "practice"`), not parent groups and not aggregate views.

| Record book | Key | Ranks on | File |
|---|---|---|---|
| Personal records | `${challengeId}:${mode}` | score, tie-broken by time | `records/personalRecords.ts:5` |
| Session records | `${mode}:d${difficulty}` | score, then tasks, then time | `sessions/sessionRecords.ts:13` |

A session banks one record; its tasks bank none (`recordPersonalBest: false`, `SessionRun.tsx:151`). **A sprint elapsed-time record is forbidden** — a seeded queue's total time is a draw lottery (`DECISIONS.md:78`).

### 2.7 Persistence — exactly four keys

```
excel-speed-trainer:v1:personal-records   PersonalRecordStore
excel-speed-trainer:v2:session-records    SessionRecordStore
excel-speed-trainer:v1:run-history        ProfileState        ← the one this plan replaces
excel-speed-trainer:v1:settings           Settings
```

All go through `JsonStorage` (`lib/storage.ts:14`), which swallows every failure — a blocked or full `localStorage` must never take the game down. Every reader has a type guard and drops what does not parse.

`ProfileState` (`profile/runHistory.ts:32`) is the problem:

```ts
export type ProfileState = {
  entries: RunHistoryEntry[];        // newest first, capped at HISTORY_LIMIT = 50
  totalRuns: number;
  totalTasksCompleted: number;
  byMode: Record<string, ProfileModeStats>;
};
```

Display list, totals accumulator, and the only history, all at once. Rows past 50 are gone forever. `byMode.bestElapsedMs` is a cross-challenge minimum, already meaningless across generated drills of different sizes. A performance graph cannot be built on it.

`RunHistoryEntry` (`:8`) carries `id`, `at`, `modeKey`, `label` (a *title string*), `score`, `elapsedMs`, `completed`, `tasksCompleted`, `isNewRecord`. Missing: challenge id, family, difficulty, target time, action counts, input mix, assist state.

`ProfilePanel` compensates with a hack that cannot survive generated variants: it recovers a run's family by looking its **title** up in a map of the 23 classics (`profile/ProfilePanel.tsx:31-33,56`). Generated runs fall through to `"mixed"`, and mastery pins their `shortcutEfficiency` to a hardcoded `0` (`:60-62`). Storing `family` on the record retires the hack.

### 2.8 What already exists that these features reuse

- **Input origin is already tracked.** `RunEvent.inputMethod` is set correctly at every call site; `LiveStatsBar` already shows a live **shortcut efficiency** (`stats/liveRunStats.ts:42`) and `ResultCard` shows it post-run (`ResultCard.tsx:132`). The *concept* has shipped; only the *resolution* is missing.
- **`ResultCard` already coaches**, and its first branch is literally `"replace pointer actions with shortcuts"` (`ResultCard.tsx:77-84`). The fastest-path card is the honest version of that sentence.
- **`shortcutLabelForEvent`** (`RunFeedbackLayer.tsx:70-100`) is a hardcoded `switch` that *guesses* a chord from an action kind — it says "Arrow key" for a `select-cell` that came from `Ctrl+↓`. This is precisely the guessing the command layer eliminates. It is deleted in Phase 1.
- **`PracticeNotes`** (`components/game/PracticeNotes.tsx`) renders authored hints and is reachable only from inside the result card, so no code path can show a hint mid-run (`IMPLEMENTATION_PLAN.md:654`, `CHANGELOG.md:76`). **The Help button is a deliberate reversal of that rule, and it pays for the reversal by making the run unranked.**
- **Deterministic URL entry points** for tests: `?template=&seed=&difficulty=` and `?sessionSeed=` (`GameShell.tsx:94-116`).
- **The tablist pattern** ships twice already (`SettingsPanel`, `LeaderboardShell` with roving tabindex). The graph's category selector should be the third instance, not a novel control.

### 2.9 Unfinished, duplicated, and conflicting systems

1. **`settings.scoring` is dead code with a live UI.** `Settings` declares `scoring: { mousePolicy; hotkeyStrictness; mistakePenalty }` (`domain/settings/themes.ts:451-504`), `SettingsPanel` renders all three, `coerceSettings` validates all three — and **nothing reads any of them.** They came from the untracked design doc (`src/app/games/excel-speed-design-implementation-plan.md:88-92`) and contradict `DECISIONS.md:195` head-on. This plan resolves it: `hotkeyStrictness` becomes the Hotkey policy (route evaluation, kept strictly apart from validation), `mousePolicy` is **deleted** as a duplicate, `mistakePenalty` stays dead and out of scope.
2. **`settings.gameplay.defaultMode` is dead** — `GameShell` always opens on `PLAY_OPTIONS[0]`. Wired in Phase 8.
3. **The authored practice notes have rotted** — four known-wrong or beaten routes (§1, decision 2). They are the reason routes must be computed.
4. **`RunModeKind`** includes `"daily"`, which nothing produces (`queue/queueTypes.ts:5`). Harmless.
5. **The docs are materially stale.** `README.md:15` says the app is not scaffolded. `ARCHITECTURE.md:444` says the variant system is "designed, not built". `CURRENT_STATE.md:100` and `DECISIONS.md:136` say all four keys are `v1` (session records are `v2`). `CURRENT_STATE.md:98` says sessions run `challenges[N % 23]`. The theme count is given as 16 in four places; there are 13. **Phase 0 fixes these, because a migration plan is unreadable against a lying baseline.**
6. **`IMPLEMENTATION_PLAN.md` Phase I (playtest tuning) is unfinished.** Orthogonal to this work; it can run in parallel.

---

## 3. Product decisions

### 3.1 Where Hotkey Mode lives

**Decision: a third value of `ChallengeMode`, presented as a seventh top-level mode button. A modifier in mechanics, a mode in the UI.**

```ts
export type ChallengeMode = "main-speed" | "practice" | "hotkey";
```

- **Its own top-level mode (chosen).** Records already key on `${challengeId}:${mode}`; history already keys on a free-form `modeKey`. One enum value yields an isolated PB book, an isolated graph category, and an isolated mastery slice with **zero** new record infrastructure — and it satisfies "a Hotkey result must not overwrite another mode's record" by construction rather than by a check.
- **A pure modifier on every mode (rejected as the primary model).** It multiplies the record books (`main-speed+hotkey`, `practice+hotkey`, `sprint-5+hotkey`…) and forces a compound record key — a schema change to two stores to express what one enum value already expresses.
- **A Practice playlist (rejected).** Practice's contract is "route notes *after* the run". Hotkey's contract is a *ranked* keyboard contest. Burying a ranked mode inside an unranked one is incoherent.

What it changes, relative to Speed:

| | Speed | Hotkey |
|---|---|---|
| Challenges | generated queue | **same** queue, filtered to keyboard-complete drills |
| Grid, validator, scoring | — | **unchanged** |
| Objective line | the prompt | prompt + `keyboard only · N optimal actions` |
| Result card leads with | time and score | **route comparison** |
| PB eligibility | complete + correctness floor | + **keyboard purity**, per `hotkeyStrictness` |
| Pointer input | allowed | allowed and reported; blocked only at `hotkeyStrictness: "ranked"` |

**Single-challenge only in v1.** Hotkey sessions would double the session record books for a mode nobody has played. Defer.

### 3.2 How help works, and when a run becomes assisted

- **The control:** a `Show fastest path` button in the run's toolbar row, plus the `?` key (`Shift+/`), which collides with nothing the grid consumes and nothing the browser reserves. The handler lives on the run surface, not inside `SpreadsheetGrid`, so the grid's keymap stays about the grid.
- **Confirmation: yes, one inline step, in every mode including Practice.** First activation swaps the button for `Reveal fastest path? This makes the run unranked. [Reveal] [Cancel]`. Because the locked rules forbid un-assisting, an accidental click would silently destroy a PB attempt with no undo — a confirmation is the only protection available, and Practice can bank a PB exactly like Speed (§1a.1), so Practice needs the same protection. It is skipped only when the persistent setting below has already started the run assisted — there is nothing left to confirm mid-run once help was visible from the first render.
- **The run becomes assisted at the moment of reveal.** `assist` flips `"none" → "revealed"` and is monotonic for the life of the attempt. Hiding the panel does not restore ranking, and the close button says so.
- **Retry starts a fresh attempt with `assist: "none"`.** This is the intended escape hatch and must be discoverable: after an assisted completion the primary action is `Retry unassisted`.
- **The run is not paused.** There is nothing left to protect — the run is unranked the instant help opens — and a pausable clock does not exist (`runClock` has none; `TODO.md:39` already flags idle handling as unsolved).
- **The timer keeps running**, visible but muted and struck through, and is never presented as a result.
- **Panel placement:** a right-hand rail whose width is **reserved from the moment the run mounts**, so revealing it cannot reflow the grid. `SpreadsheetGrid` already snapshots its own presentation on mount for exactly this reason (`SpreadsheetGrid.tsx:69-74`) — moving a target under the player mid-run is a bug this codebase already takes seriously. Below 1024 px the rail becomes a drawer *below* the grid; the page scrolls, the grid does not move.
- **Persistent setting:** `settings.help.autoRevealInPractice` (default `false`). When on, Practice runs **start** with the panel already visible, no confirmation (there is nothing to confirm before the run has even begun), and therefore bank no Practice PB **for that run** — the same `assist === "revealed"` rule that unranks any other assisted run, applied from the first render instead of from a mid-run reveal (§1a.1). Turning the setting off restores ordinary, record-eligible Practice runs. The mode button reads `Practice · assisted` while the setting is on, exactly as a rankable mode would, because Practice *is* rankable — the setting is simply choosing to start every Practice run already unranked.

### 3.3 Which records an assisted run affects

An assisted run:

- **is stored**, with `assist: "revealed"`;
- **appears in Recent Runs** with an `Assisted` badge and **no official time** (the time column reads `—`);
- **never** creates or updates a personal record, a session record, a timed record, a leaderboard entry, or any best/average calculation;
- **never** enters the performance graph;
- **does** count toward practice activity: total runs, tasks completed, mastery.

Its result card is a *learning* card: route comparison first, missed shortcuts second, time nowhere.

### 3.4 How fastest paths are represented

**Computed by search, with an authored-override registry in front.**

A `Route` is an ordered list of `RouteStep`s naming **semantic commands**, not keystrokes. Keystrokes render from the keymap at display time, per platform. That is what lets one definition serve Windows and macOS, keyboard and mouse, and every seeded variant of a template at every difficulty.

Two sources, in priority order:

1. `routeRegistry.byTemplate(templateId, templateVersion)` — an authored resolver, for pedagogy or for what the solver cannot reach.
2. `solveRoute(challenge)` — BFS over the keyboard command set against the real reducer and validator, returning every shortest route (capped at 3).

**Routes attach to a separate registry keyed by `templateId@templateVersion` (and by `challengeId` for the classics), never as a field on `Challenge`.** A `Challenge` is a generated value object and must not carry teaching content; routes must version independently; and a route must be resolvable for a challenge the registry has never seen — which a required field cannot express.

### 3.5 How categories map to modes

One to one. No migration.

| Category | `modeKey`s | Primary metric | Secondary | Min points |
|---|---|---|---|---|
| Speed | `main-speed` | score | pace index | 3 |
| Practice | `practice` | score | pace index | 3 |
| Hotkey | `hotkey` | score | keyboard purity | 3 |
| Sprint 5 | `sprint-5` | score | — | 3 |
| Sprint 10 | `sprint-10` | score | — | 3 |
| 30s | `timed-30` | score | tasks completed | 3 |
| 60s | `timed-60` | score | tasks completed | 3 |

### 3.6 Which metric, and why not raw time

**Score is primary everywhere.** It is the only number already comparable across draws: `speedMultiplier = clamp(targetSeconds / elapsedSeconds, 0.2, 2.0)` normalises each task against *its own* target (`scoreRun.ts:22`), which is the stated reason seeded queues were permitted at all (`DECISIONS.md:65-80`).

**Raw elapsed time is not plotted.** A `gen.navigation.first-in-column` at 4 s and a `gen.mixed.sort-and-format` chain-3 at 16 s on one line is not a trend.

**Pace index** = `elapsedMs ÷ targetMs`, rendered `1.20× target`, lower is better, comparable across every drill because the target is per-drill. It requires `targetMs` on the record — which is why the canonical model stores it.

Sessions have no single target, so they plot score; timed sessions additionally plot tasks completed.

---

## 4. Proposed architecture

### 4.1 Layer map

```
INPUT                     ┌───────────────────────────────────────────────┐
  keydown ───────────────►│ keymap.matchChord(event) → GridCommandId      │  NEW
  cell click ────────────►│ pointer commands (CLICK_CELL, DRAG_SELECT…)   │  NEW
  toolbar click ─────────►│ toolbar commands (SORT_DESC, FILTER_TO_VALUE) │  NEW
  filter menu ───────────►│ menu commands                                 │  NEW
                          └──────────────────┬────────────────────────────┘
                                             │ ActionMeta { command, via, chord, inputMethod }
                          ┌──────────────────▼────────────────────────────┐
COMMAND                   │ resolveCommand(command, grid) → GridAction|nil │  NEW
                          └──────────────────┬────────────────────────────┘
                          ┌──────────────────▼────────────────────────────┐
DOMAIN (unchanged)        │ gridReducer → validateChallenge → scoreRun     │
                          └──────────────────┬────────────────────────────┘
                                             │ RunEvent { atMs, action, command, via, chord }
                          ┌──────────────────▼────────────────────────────┐
RUN                       │ useGameRun                                     │
                          │   ├─ getRunEligibility(record) ───────────────┼─► the only policy   NEW
                          │   ├─ personal records (gated by it)           │
                          │   └─ RunRecord ──► runLog                     │  NEW
                          └──────────────────┬────────────────────────────┘
             ┌───────────────────────────────▼──────────────────────────────┐
ROUTE  NEW   │ solveRoute(challenge) · routeRegistry · compareRoute          │
             └───────────────────────────────┬──────────────────────────────┘
             ┌───────────────────────────────▼──────────────────────────────┐
UI           │ FastestPathCard · HelpPanel · HotkeyResultCard                │  NEW
             │ RecentRuns (selector: latest 20)                              │  NEW
             │ PerformanceChart + CategorySelector (selector: all eligible)   │  NEW
             └──────────────────────────────────────────────────────────────┘
```

### 4.2 New files

```
src/domain/commands/commandTypes.ts     GridCommandId, ActionSource, ActionVia, ActionMeta, Chord, CommandDefinition
src/domain/commands/commandRegistry.ts  COMMAND_REGISTRY — the one canonical registry (see §1a.3)
src/domain/commands/keymap.ts           matchChord, chordLabel — pure functions reading the registry
src/domain/commands/resolveCommand.ts   CommandContext, resolveCommand(command, context) → GridAction | null

src/domain/routes/routeTypes.ts         Route, RouteStep, RouteComparison, MissedShortcut
src/domain/routes/solveRoute.ts         BFS optimal-route solver
src/domain/routes/routeRegistry.ts      authored overrides
src/domain/routes/compareRoute.ts       player stream vs accepted routes
src/domain/routes/hotkeyEligibility.ts  isHotkeyPersonalBestEligible(record, strictness)
src/domain/routes/routeCache.ts         memoised by `${challenge.id}:${challenge.seed}`

src/domain/runs/runRecord.ts            RunRecord, type guards, RUN_LOG_KEY
src/domain/runs/runEligibility.ts       getRunEligibility — THE policy
src/domain/runs/runLog.ts               append, read, trim, selectors
src/domain/runs/migrateRunHistory.ts    run-history v1 → run log

src/domain/stats/categories.ts          PERFORMANCE_CATEGORIES + METRICS
src/domain/stats/performanceSeries.ts   log → filter → project → aggregate → series
src/domain/stats/rollingAverage.ts

src/hooks/useRunLog.ts                  useSyncExternalStore over the log
src/hooks/useAssist.ts                  assist state for one attempt
src/hooks/useFastestPath.ts             lazy, memoised route resolution

src/lib/platform.ts                     getPlatform() — LABELS ONLY, never handling

src/components/grid/FilterMenu.tsx      keyboard-reachable sort/filter menu (Alt+↓)
src/components/game/HelpPanel.tsx
src/components/game/FastestPathCard.tsx
src/components/game/RouteComparisonRows.tsx
src/components/game/UnrankedBadge.tsx
src/components/profile/RecentRuns.tsx
src/components/profile/PerformanceChart.tsx     hand-rolled SVG, no dependency
src/components/profile/CategorySelector.tsx     role="tablist", mirroring LeaderboardShell
```

### 4.3 Files that change

| File | Change |
|---|---|
| `domain/runs/runTypes.ts` | `RunEvent` gains `command`, `via`, `chord` (optional) |
| `domain/runs/eventDigest.ts` | canonical form includes `command`; `DIGEST_VERSION → "v2"` (nothing persists it, so free) |
| `domain/grid/gridReducer.ts` | **no change** |
| `domain/validation/*` | **no change** |
| `domain/scoring/scoreRun.ts` | **no change** |
| `components/grid/SpreadsheetGrid.tsx` | keydown delegates to `matchChord` + `resolveCommand`; opens `FilterMenu` |
| `components/game/Toolbar.tsx` | buttons emit commands; **focus returns to the grid after a command** |
| `components/game/RunFeedbackLayer.tsx` | `shortcutLabelForEvent` **deleted**; label comes from the keymap |
| `hooks/useGameRun.ts` | `dispatch(action, meta)`; PB gated by `getRunEligibility`; emits a `RunRecord` |
| `components/game/ChallengeRun.tsx` | Help control, unranked badge, fastest-path card |
| `components/game/SessionRun.tsx` | Help control (assists the whole session) |
| `components/game/ResultCard.tsx` | fastest-path + comparison sections; assisted variant |
| `components/game/GameShell.tsx` | 7th mode button; `defaultMode` honoured |
| `components/profile/ProfilePanel.tsx` | reads the log; hosts chart + Recent Runs |
| `domain/settings/themes.ts` | `+ help`, `+ stats`; `scoring.mousePolicy` **removed** |
| `domain/profile/runHistory.ts` | **read-only** for migration, then retired |

### 4.4 Event flow, end to end

1. Player presses `Ctrl+Shift+↓`.
2. `matchChord(event)` → `EXTEND_JUMP_DOWN`, `chord: "mod+shift+ArrowDown"`.
3. `resolveCommand("EXTEND_JUMP_DOWN", grid)` → `{ kind: "select-range", range }`.
4. `run.dispatch(action, { command, via: "shortcut", inputMethod: "keyboard", chord })`.
5. `gridReducer` folds it; an unchanged object still drops the event (existing behaviour).
6. `RunEvent` appended **with the command**.
7. On completion, `getRunEligibility` decides banking and a `RunRecord` is appended.
8. The result card resolves routes (`routeRegistry` → `solveRoute`), runs `compareRoute`, renders.

---

## 5. Data model

### 5.1 Commands

```ts
// src/domain/commands/commandTypes.ts
export type GridCommandId =
  | "MOVE_UP" | "MOVE_DOWN" | "MOVE_LEFT" | "MOVE_RIGHT"
  | "JUMP_UP" | "JUMP_DOWN" | "JUMP_LEFT" | "JUMP_RIGHT"
  | "EXTEND_UP" | "EXTEND_DOWN" | "EXTEND_LEFT" | "EXTEND_RIGHT"
  | "EXTEND_JUMP_UP" | "EXTEND_JUMP_DOWN" | "EXTEND_JUMP_LEFT" | "EXTEND_JUMP_RIGHT"
  | "SELECT_COLUMN" | "SELECT_ROW" | "SELECT_TABLE"
  | "TOGGLE_BOLD" | "FORMAT_CURRENCY" | "FORMAT_PERCENT" | "FORMAT_DATE"
  | "OPEN_FILTER_MENU" | "SORT_ASC" | "SORT_DESC"
  | "FILTER_TO_VALUE" | "FILTER_ABOVE_VALUE" | "CLEAR_FILTERS"
  | "TOGGLE_FILTER" // mod+Shift+L, keyboard-only; see §1a.10
  // pointer-origin; never searched by the solver
  | "APPLY_BOLD" // toolbar's Bold button — sets bold on unconditionally; see §1a.9
  | "CLICK_CELL" | "DRAG_SELECT_RANGE" | "CLICK_COLUMN_HEADER" | "CLICK_ROW_HEADER";

/** How the player physically produced it. Known exactly — minted at the input boundary. */
export type ActionSource = "keyboard" | "pointer";

/** Which surface carried it. A keyboard-activated toolbar button is `keyboard` + `toolbar`. */
export type ActionVia = "shortcut" | "grid" | "toolbar" | "menu";

export type ActionMeta = {
  command: GridCommandId;
  inputMethod: ActionSource;
  via: ActionVia;
  /** The chord that matched, e.g. "mod+shift+ArrowDown". Null for pointer input. */
  chord: string | null;
};
```

**Revised in §1a.2:** `ActionSource` gains `"unknown"`, and `ActionMeta` gains `controlId: string | null` alongside `chord`, so pointer/toolbar/menu input carries its own raw evidence the way keyboard input carries `chord`. §1a.2 is authoritative for this type; the block above is the original first draft, kept for context.

Two derived metrics, deliberately distinct:

- **`keyboardShare`** = keyboard events ÷ total. A keyboard-only player who tabs to the toolbar scores 1.0. **This is what Hotkey purity gates on**, so the mode stays reachable for keyboard-only and assistive-tech users.
- **`shortcutShare`** = events with `via ∈ {shortcut, menu}` ÷ total. **This is what coaching keys off** — the number that says "you used the buttons; here is the chord".

### 5.2 Keymap

```ts
export type Chord = {
  /** Preferred for digits and punctuation: layout-independent. */
  code?: string;
  /** Preferred for letters: a Dvorak player expects letter semantics, not position. */
  key?: string;
  /** Cmd OR Ctrl. Accepted on every platform, no sniffing (DECISIONS.md:96). */
  mod?: boolean;
  /** Ctrl specifically — for chords Cmd collides with at OS level. */
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
};

export type KeyBinding = {
  command: GridCommandId;
  chords: Chord[];                       // every chord that fires it
  label: { windows: string; mac: string }; // what we SHOW; handling accepts both modifiers
  note?: string;                         // surfaced when the platforms genuinely differ
};
```

The chords Phase 2 adds, and why each is safe:

| Command | Chord | Rationale |
|---|---|---|
| `OPEN_FILTER_MENU` | `Alt` + `↓` | Excel's filter dropdown. `Alt+↓`/`Alt+↑` are free in browsers. **`Alt+←`/`Alt+→` are browser history navigation and must never be bound.** `matchChord` gains a specificity rule (§1a.2) so `Alt+↓` doesn't also satisfy plain `MOVE_DOWN`. |
| `SORT_ASC` / `SORT_DESC` | inside the menu (`↑`/`↓`, `Enter`) | No new global chord — menu-reachable only (§1a.10). Mirrors Excel, where sort lives in the filter dropdown — and matches the brief's own example route exactly. |
| `FILTER_TO_VALUE` | inside the menu | No new global chord — menu-reachable only (§1a.10). Excel's AutoFilter. |
| `FILTER_ABOVE_VALUE` | inside the menu | No new global chord — menu-reachable only (§1a.10). |
| `CLEAR_FILTERS` | inside the menu, when filters exist | Menu-reachable only (§1a.10); also produced directly by `TOGGLE_FILTER` below. |
| `TOGGLE_FILTER` | `mod` + `Shift` + `L` | A new command, not a shared chord on `FILTER_TO_VALUE`/`CLEAR_FILTERS` — see §1a.10 for why. Excel's AutoFilter chord, toggle semantics. Unreserved in Chrome, Firefox, and Safari. |
| `FORMAT_DATE` | `mod` + `Shift` + `3` (label: **Ctrl only**) | Excel's date format. `Cmd+Shift+3` is a macOS screenshot and cannot be intercepted, so the macOS *label* reads `Ctrl` — same pattern as `FORMAT_CURRENCY`/`FORMAT_PERCENT` below, handling still accepts `mod` (§1a.10). Same class of exception as the existing `Ctrl+Space` (`DECISIONS.md:100`). |

The same reasoning retroactively fixes currency and percent: `Cmd+Shift+4/5` are macOS screenshots, so the **macOS label must read `Ctrl+Shift+4`**. Handling still accepts both — a labelling fix, not a behaviour change, and only possible now that a platform-aware label layer exists. (This label fix already shipped in Phase 1's `commandRegistry.ts`, ahead of this section; confirmed here, not redone.)

### 5.3 The run event

```ts
export type RunEvent = {
  atMs: number;
  action: GridAction;
  inputMethod?: RunInputMethod;   // kept: existing consumers
  command?: GridCommandId;        // new; optional so an older replay still parses
  via?: ActionVia;
  chord?: string | null;
};
```

### 5.4 The canonical run record

```ts
// src/domain/runs/runRecord.ts
export const RUN_LOG_KEY = "excel-speed-trainer:v1:run-log";
export const RUN_RECORD_VERSION = 2;      // 1 = migrated from run-history v1
export const RECENT_RUNS_LIMIT = 20;      // display window
export const RUN_LOG_LIMIT = 5_000;       // storage guard; see §9.7

export type RunAssist = "none" | "revealed";
export type RunOutcome = "completed" | "failed" | "expired";
export type RunIntegrity = "ok" | "suspect";

export type RunRecord = {
  schemaVersion: 1 | 2;
  id: string;
  atMs: number;                          // epoch ms — sorting, bucketing, arithmetic
  at: string;                            // ISO 8601 — display only

  modeKey: string;                       // "main-speed" | "practice" | "hotkey" | SessionMode
  categoryId: PerformanceCategoryId | null;  // denormalised at write time
  label: string;
  challengeId: string | null;            // null for sessions
  challengeVersion: string | null;
  templateId: string | null;
  family: SkillFamily | null;            // retires ProfilePanel's title-lookup hack
  difficulty: ChallengeDifficulty | null;
  seed: string | null;

  outcome: RunOutcome;
  completed: boolean;
  tasksCompleted: number;
  taskCount: number;

  score: number;
  elapsedMs: number;
  targetMs: number | null;               // enables pace index; null for sessions and legacy
  correctness: number;
  accuracy: number;

  actions: number | null;                // route fields: null on legacy
  keyboardActions: number | null;
  shortcutActions: number | null;
  optimalActions: number | null;
  routeEfficiency: number | null;        // clamp(optimal / actual, 0, 1)
  keyboardShare: number | null;          // 0..1 — the Hotkey purity gate
  routeId: string | null;

  assist: RunAssist;
  integrity: RunIntegrity;
  isNewRecord: boolean;
  attempts: number;                      // retries before this completion, within one mount
  eventDigest: string | null;
};
```

Deliberately **not** stored:

- **`replayEvents`** — the largest thing in a `RunResult`; persisting them would exhaust the storage budget within a few hundred runs.
- **`eligibility`** — it is *derived*, so a policy change retro-applies to old runs. That is the entire point of having one policy function.

At ~300 bytes of JSON per record, 5 000 records is ≈1.5 MB — comfortable alongside the other three books inside a 5 MB budget.

### 5.5 The run log

```ts
export type RunLog = {
  version: 2;
  /** Runs the v1 50-cap destroyed before this feature existed. Keeps totals honest. */
  priorTotals: { runs: number; tasksCompleted: number };
  /** Runs folded into daily buckets past RUN_LOG_LIMIT. Empty until then. */
  rollups: RunRollup[];
  /** Chronological, oldest first. Appending is O(1); every view filters or reverses. */
  runs: RunRecord[];
};
```

Selectors (pure, each tested):

```ts
selectRecentRuns(log, limit = RECENT_RUNS_LIMIT): RunRecord[]   // newest first, capped
selectEligibleForStats(log, categoryId): RunRecord[]            // chronological, filtered
selectTotals(log): { runs: number; tasksCompleted: number }     // priorTotals + rollups + runs
selectByMode(log): Record<string, ProfileModeStats>
```

**The 20-item limit is enforced in the selector, never in the render.** `RecentRuns` is handed exactly 20 records and cannot display more.

### 5.6 The eligibility policy — one function, one file

```ts
// src/domain/runs/runEligibility.ts
export type RunEligibility = {
  countsForPersonalBest: boolean;
  countsForPerformanceStats: boolean;
  countsForLeaderboard: boolean;
  countsForRecentRuns: boolean;
  countsForPracticeActivity: boolean;
};

export function getRunEligibility(run: RunRecord): RunEligibility;
```

Rules, in order (§1a.4 confirms this list is unchanged — an earlier draft of that section wrongly inserted a Practice-specific rule here; it has been removed):

1. `integrity === "suspect"` → everything `false`. Still stored, for audit.
2. `assist === "revealed"` → PB, stats, leaderboard `false`; recent, practice `true`.
3. `outcome !== "completed"` → PB, stats, leaderboard `false`; recent `true` (labelled), practice `true`.
4. `schemaVersion === 1` (migrated legacy) → PB `false` (the PB books are authoritative and are never re-derived), stats `true`, leaderboard `false`, recent `true`, practice `true`.
5. Otherwise → everything `true`.

**Purity is deliberately not handled here.** Whether a Hotkey run is pure enough for its PB is a *route* question, and route evaluation stays strictly separate from run classification — the same separation `DECISIONS.md:195` draws between validation and route. It is answered by `isHotkeyPersonalBestEligible(record, strictness)` and by the category registry's `requires` clause. One concern, one place.

`useGameRun` replaces its inline check (`useGameRun.ts:127`) with:

```ts
if (recordPersonalBest
    && getRunEligibility(record).countsForPersonalBest
    && isPersonalRecordEligible(challenge, validation)) {
  submit(...)
}
```

`isPersonalRecordEligible` survives as the correctness-floor helper it already is. The policy composes it rather than duplicating it.

### 5.7 Routes

```ts
export type RouteStep = {
  command: GridCommandId;
  label: string;              // player-facing, command-level; chords render from the keymap
  argument?: string;          // e.g. "West", so the card can say "Filter to West"
  optional?: boolean;
  group?: string;             // steps sharing a group may be performed in any order
};

export type Route = {
  id: string;
  label: string;              // "Keyboard route" | "Mouse route"
  kind: "keyboard" | "mouse" | "mixed";
  steps: RouteStep[];
  optimalActions: number;     // steps.filter(s => !s.optional).length
  keyboardComplete: boolean;  // every step has a chord in the keymap
  source: "solver" | "authored";
  version: string;
};
```

**Revised in §1a.5:** `RouteStep` gains `cost`, and `Route` gains `optimalCost` alongside `optimalActions` — count and weight are kept as two distinct fields from day one, even though Phase 4 ships every command at `cost: 1` (so the two numbers are identical until a real weight is introduced). §1a.5 is authoritative.

```ts

export type MissedShortcut = {
  kind: "repeated-step" | "pointer-instead-of-key" | "toolbar-instead-of-chord";
  observed: string;           // "4 × Arrow Down"
  suggested: GridCommandId;
  suggestedChordLabel: string;// platform-resolved: "Ctrl + ↓"
  savedActions: number;
};

export type RouteComparison = {
  optimalActions: number;
  playerActions: number;
  extraActions: number;
  efficiency: number;         // clamp(optimal / player, 0, 1)
  keyboardActions: number;
  pointerActions: number;
  keyboardShare: number;
  shortcutShare: number;
  matchedRouteId: string | null;
  missedShortcuts: MissedShortcut[];
  confidence: "high" | "low"; // "low" means: say less, not more
};
```

### 5.8 Categories

```ts
export type PerformanceMetricId = "score" | "paceIndex" | "tasksCompleted" | "keyboardShare";
export type PerformanceCategoryId =
  | "speed" | "practice" | "hotkey" | "sprint-5" | "sprint-10" | "timed-30" | "timed-60";

export type PerformanceCategory = {
  id: PerformanceCategoryId;
  label: string;
  /** modeKeys in the log that belong here. A future mode registers by adding one entry. */
  modeKeys: string[];
  metrics: PerformanceMetricId[];        // [0] is the default
  minimumDataPoints: number;
  /** Beyond global eligibility. Hotkey sets { keyboardPure: true }. */
  requires?: { keyboardPure?: boolean };
  /** Above this many points, bucket by local day before plotting. */
  aggregateAbove: number;                // 400
};

export const METRICS: Record<PerformanceMetricId, {
  label: string;
  unit: string;
  lowerIsBetter: boolean;
  value: (run: RunRecord) => number | null;   // null → not plottable on this metric
}>;
```

A new mode becomes a graph category by adding one object. **No component contains a mode string** — a test asserts it.

### 5.9 Settings changes

```ts
// added
help:  { autoRevealInPractice: boolean;      // default false
         confirmBeforeReveal: boolean };     // default true
stats: { lastCategoryId: PerformanceCategoryId;   // default "speed"
         lastMetricId: PerformanceMetricId;       // default "score"
         lastRange: "7d" | "30d" | "90d" | "all" }; // default "all"

// changed
scoring: {
  hotkeyStrictness: "encouraged" | "strict" | "ranked";  // default "strict" — NOW LIVE
  mistakePenalty: "light" | "standard" | "strict";       // still unread; out of scope
  // mousePolicy: REMOVED — duplicate of hotkeyStrictness
};
gameplay: { defaultMode: DefaultMode };  // gains "hotkey"; GameShell now honours it
```

`coerceSettings` is total and already falls back on unknown values (`themes.ts:589-720`), so an old settings blob upgrades silently and `mousePolicy` disappears with no migration. The graph's selection persists through `settings.stats` rather than a fifth storage key.

---

## 6. Fastest-path model

### 6.1 Four questions, kept separate

| Question | Answered by | Status |
|---|---|---|
| Did the workbook reach the correct state? | `validateChallenge(challenge, grid)` | pure, shipped, **untouched** |
| What meaningful actions occurred? | `RunEvent.command` | new — minted at the input boundary |
| How was each performed? | `inputMethod` + `via` + `chord` | new — **known exactly**, not inferred |
| How close was the route to optimal? | `compareRoute(events, routes)` | new — pure, testable |

Correctness validation and route evaluation never touch. A mouse player still completes and still scores. Route quality is a separate report.

### 6.2 Raw input → semantic action

The critical property: **the command is minted where the input arrives, not reconstructed afterwards.** Nothing is guessed from a `GridAction` after the fact — which is exactly what `shortcutLabelForEvent` does today, and why it says "Arrow key" for a `Ctrl+↓`.

- `keydown` → `matchChord(event)` → command + matched chord id. Unmatched keys are ignored, as today.
- Cell click → `CLICK_CELL`. Drag → `DRAG_SELECT_RANGE`; consecutive drag events sharing an anchor collapse to one command for counting.
- Header click → `CLICK_COLUMN_HEADER` / `CLICK_ROW_HEADER`.
- Toolbar → the command, `via: "toolbar"`. **Whether it was clicked or activated with `Enter` is known**, so a keyboard-only player is credited as keyboard while still being told the chord exists.
- Filter menu → `via: "menu"`, `inputMethod` per how it was driven.

### 6.3 The solver

```ts
export function solveRoute(challenge: Challenge, options?: {
  maxDepth?: number;   // default 8
  maxNodes?: number;   // default 20_000
  maxRoutes?: number;  // default 3
}): Route[] | null;
```

Breadth-first over `KEYBOARD_COMMANDS` (the ~26 unparameterised keyboard commands, derived from the keymap so it cannot drift from what the game accepts):

- **Start:** `challenge.initialGrid`.
- **Transition:** `resolveCommand(command, grid)` → `GridAction | null` → `gridReducer`. The reducer returns the identical object for a no-op, so dead commands prune themselves for free.
- **Goal:** `validateChallenge({ challenge, grid, run: SYNTHETIC_RUN }).isComplete`. Validators ignore `run` (§2.4), and `eligibility.ts:149-161` already does exactly this. **A single assertion test pins the assumption: if a validator ever reads `run`, that test fails loudly.**
- **Visited set:** a canonical grid signature — `activeCell`, `selection`, `sortState`, `filters`, and a format hash over the used range. Without it the search loops on `↓↑↓↑`; with it the space collapses to a few thousand nodes for every drill in the game.
- **All shortest routes:** BFS finds every route at the goal depth. Take up to 3, dedupe by command sequence.
- **Failure:** exceeding depth or nodes returns `null`, and the card says *"No fastest path is available for this drill."* It never invents one.

**Why parameterised commands stay deterministic.** `FILTER_TO_VALUE` filters by the *active cell's* value, exactly as the toolbar does (`Toolbar.tsx:62`). "Filter to West" is therefore not a branching parameter — it is *navigate to a cell holding West, then filter*, which the search discovers on its own. That is the same route a human takes, and it falls out of the engine's existing semantics for free.

**What the solver gets right that a human author does not** (all four are live bugs today, §1):
the header counting as data for `Ctrl+Up`; `Ctrl+Space` being cheaper than `click + Ctrl+Shift+Down`; `Ctrl+Space` clobbering `activeCell` and breaking a subsequent filter; and the difficulty-4/5 table offset changing the route.

**Composites** are solved leaf by leaf: BFS the first part, then BFS the second from the resulting state, concatenate. This is *near*-optimal, not provably optimal — a globally better route might interleave the parts — and the UI says so: a composite's heading reads **"a fast path"**, not "the fastest path". A joint search at depth 12+ is not worth the budget.

**When it runs.** Never during a live scored run. `useFastestPath` computes lazily and memoises on `${challenge.id}:${challenge.seed}`, triggered by the result card mounting or by help being revealed — which has already unranked the run, so the milliseconds cost nothing.

### 6.4 Authoring, storage, validation, versioning, display

- **Authoring is the exception.** `routeRegistry` holds hand-written resolvers keyed by `templateId@templateVersion`, used only where the solver's shortest route is pedagogically poor.
- **Storage:** routes are code derived from the challenge, so they cannot drift from it.
- **Validation — the two highest-value tests in this plan:**
  1. *Every authored route actually solves its challenge* — replay its commands through the real reducer, assert `isComplete`.
  2. *No authored route is longer than the solver's optimum.* **This test, applied to the existing practice notes, fails today on at least four of them.**
- **Versioning:** `Route.version`. Because routes resolve per template version, and a template version bump already starts a new record book (`DECISIONS.md:63`), an optimal-path change and a comparability break are already the same event. Nothing new is needed.
- **Display:** `RouteStep.label` plus the chord resolved for the current platform. One definition, two renderings.

### 6.5 Platform variants

`src/lib/platform.ts` reads `navigator.userAgentData?.platform ?? navigator.platform` **once**, returns `"mac" | "windows"`, defaults to `"windows"` during SSR, and is injectable for tests.

It is used **only to choose a label string.** Chord *handling* still accepts `Cmd` and `Ctrl` interchangeably, so `DECISIONS.md:96` stands — that decision governs which modifiers the game *accepts*, not which words it *prints*. The distinction is subtle enough that it must be written into `DECISIONS.md` as an amendment, or the next agent will assume the ban is total.

Where the platforms genuinely differ, the card shows both and says why:

```
3.  Format as currency
    Windows   Ctrl + Shift + 4
    macOS     Ctrl + Shift + 4     Cmd + Shift + 4 is a macOS screenshot.
```

### 6.6 The hard cases, and what is honestly claimed

| Case | Handling | Confidence |
|---|---|---|
| Repeated keypresses | Each is one command. `4 × MOVE_DOWN` is run-length compressed for display and flagged as a missed `JUMP_DOWN` when a jump reaches the same cell. | high |
| Key held (auto-repeat) | Indistinguishable from repeats at the DOM level. Counted as N actions — which is **correct**: N grid moves happened. | high |
| Drag-select | Many `select-range` actions; consecutive drag events sharing an anchor collapse to one command. | high |
| Undo / redo | **Do not exist in the engine.** Out of scope. If added, they must emit commands and count as actions. | n/a |
| Equivalent shortcuts | Many chords, one command. Comparison is at the command level, so `Cmd+B` and `Ctrl+B` are one step. | high |
| Mouse and menu equivalents | Same command, different `via`. This is what powers "you used the toolbar; the chord is X". | high |
| Same end state, different route | BFS returns *all* shortest routes; comparison matches any of them. | high |
| Steps valid in any order | `RouteStep.group` marks order-free steps; comparison treats a group as a set. | high |
| Actions before the timer | **Cannot happen** — the clock starts when the grid appears (`DECISIONS.md:268`). | high |
| Browser-reserved chords | Enumerated and avoided (§5.2). `Alt+←/→` and `Cmd+Shift+3/4/5` are the live hazards. | high |
| Accessibility input | A keyboard-activated toolbar button counts as **keyboard** (purity intact) but not as a **shortcut** (coaching still fires). Hotkey Mode stays reachable for assistive tech. | high |
| Remapped keyboards, non-QWERTY | `code` for digits and punctuation (layout-independent), `key` for letters (semantic). A player who remapped at OS level is credited for the command they produced — the honest answer, since the app cannot see the physical key. | medium |
| Synthetic event injection | `event.isTrusted` is recorded and **acted on by nothing.** jsdom and Testing Library dispatch untrusted events, so gating would break the suite and stop nobody real. | **none — declared, not solved** |
| Direct formula entry, paste | The engine has neither. Out of scope. | n/a |

**What is never claimed:** that a hotkey was used when the app cannot tell. Because the command is minted at the input boundary rather than inferred from the resulting action, the app *can* tell — for every input path it owns. Where it cannot (OS remaps, physical keycaps), the card describes the **command**, never the player's fingers.

### 6.7 Route comparison

1. Project events to a command stream; collapse drag runs.
2. `optimalActions` = shortest accepted route; `playerActions` = stream length; `extraActions = max(0, player − optimal)`; `efficiency = clamp(optimal / player, 0, 1)`.
3. `keyboardShare`, `shortcutShare` from `inputMethod` / `via`.
4. Missed shortcuts, three detectors:
   - **repeated-step** — a run of ≥3 identical `MOVE_*`/`EXTEND_*` whose end cell equals what one `JUMP_*` reaches. Saves `n − 1`.
   - **pointer-instead-of-key** — a `CLICK_CELL`/`CLICK_*_HEADER` the keyboard could have reached.
   - **toolbar-instead-of-chord** — any command with `via: "toolbar"` that the keymap can fire.
   Capped at three, ranked by actions saved.
5. `confidence: "low"` when any event lacks a `command`; the card then shows counts and hides the route diff rather than guessing.

---

## 7. UX specification

Behaviour, hierarchy, states. No mockups.

### 7.1 In-run Help control

In the toolbar row (`ChallengeRun.tsx:117-119`), right-aligned, so it never sits between the prompt and the grid.

| State | Renders |
|---|---|
| idle | `Show fastest path`, `aria-keyshortcuts="?"` |
| confirming | inline `Unranks this run.` `[Reveal]` `[Cancel]` — `Escape` cancels; focus stays on the two buttons |
| revealed | `Hide fastest path` — toggles visibility only; the run stays unranked and the `aria-description` says so |
| unavailable | **absent.** The solver found no route. Never a disabled mystery button. |

### 7.2 Help panel

A right rail, `role="complementary"`, `aria-label="Fastest path"`, **width reserved from mount so revealing it cannot move the grid**. Contents match the post-run card (§7.5) minus the comparison rows, which do not exist yet. Below 1024 px it becomes a drawer below the grid; the page scrolls, the grid does not move.

### 7.3 Unranked notification

The instant help is revealed:

- The PB chip in the prompt rail is replaced by `UNRANKED · assisted` in the warning token.
- One `aria-live="polite"` announcement: *"Fastest path revealed. This run is now unranked."* The run surface already owns exactly one live region (`RunFeedbackLayer.tsx:116`), so this reuses it rather than adding a second.
- The timer switches to the muted token with a strikethrough.
- The badge persists for the attempt and cannot be dismissed.

### 7.4 Hotkey Mode selector and objective

`GameShell`'s mode group (`GameShell.tsx:286-303`) gains a seventh button, `Hotkey`, inside the same `role="group" aria-label="Mode"`. Seven fit one row at desktop widths; below that the group wraps, as it already does.

The prompt rail gains a second line: `Keyboard only · N optimal actions`. The count comes from the solver *before* the run starts — it is a property of the challenge, not of the player, so it gives nothing away and is not assistance.

The live stats bar's `Shortcuts` cell moves to first position.

At `hotkeyStrictness: "ranked"`, pointer events on the grid and toolbar are ignored and a one-line notice says why. Never the default; always reversible in settings.

### 7.5 Post-run fastest-path card

Appended to `ResultCard`, below the stat rows and above `Details`:

```
FASTEST PATH                                     keyboard · 5 actions

1.  Jump to the bottom of the column      Ctrl + Shift + ↓
2.  Turn on filters                       Ctrl + Shift + L
3.  Open the filter menu                  Alt + ↓
4.  Choose "West"                         ↓ ↓ then Enter
5.  Apply                                 Enter

Optimal actions   5
Your actions      8
Extra actions     3
Efficiency        63%

MISSED SHORTCUTS
  4 × Arrow Down              →  Ctrl + ↓             saves 3 actions
  Toolbar "Sort high to low"  →  Alt + ↓, Enter       saves 1 action

[ Show the mouse route ]      (collapsed by default)
```

- Steps are numbered, semantic, and carry a platform-resolved chord.
- Two routes tied for shortest → a `Route A / Route B` toggle above the steps.
- A composite reads `A FAST PATH`, with a footnote that the parts were optimised independently.
- Solver returned nothing → `No fastest path is recorded for this drill yet.` No fabrication.
- **The mouse route is not always available either.** `formatting.unbold-header` (`data/challenges/index.ts:442`) has **no mouse-only solve** — the toolbar's Bold button always sends `{bold: true}` (`Toolbar.tsx:83`), never a toggle, so only `Ctrl/Cmd+B` can unbold. The card says so rather than pretending.

### 7.6 Assisted run card

The same card, three differences:

- The 4xl time readout becomes `Assisted run — not ranked`.
- No score, no PB line, no PB delta. (The score is still computed internally; it is simply never presented as a result.)
- The primary button becomes `Retry unassisted`; `Next challenge` stays secondary.

### 7.7 Recent Runs

`/profile`, replacing the current `<ol>` (`ProfilePanel.tsx:154-187`). A table, because it now carries seven columns.

| When | Mode | Challenge | Result | Time | Accuracy | Flags |
|---|---|---|---|---|---|---|
| Jul 13, 14:02 | Speed | Selection · d2 | 1 420 pts | 6.41s | 100% | `PR` |
| Jul 13, 13:58 | Practice | Sort/Filter · d2 | 980 pts | — | 100% | `Assisted` |
| Jul 13, 13:51 | Sprint 5 | 5 tasks | 4 210 pts | 38.2s | 96% | |
| Jul 13, 13:44 | Hotkey | Navigation · d2 | 1 610 pts | 4.02s | 100% | `PR` `Pure` |

- Exactly 20 rows, newest first, enforced by `selectRecentRuns`.
- Footer: **`Showing the latest 20 of 412 runs. Older runs still count toward your trends.`** This is the sentence that stops the 20-cap reading as data loss.
- Failed runs carry a `Failed` flag and a `—` result. Assisted runs show `—` for time. **Abandoned and restarted runs never appear, because they are never written** (§8).
- Empty state: `No runs yet. Play one and come back.`

### 7.8 Performance graph

`/profile`, above Recent Runs.

- **Category selector:** a `role="tablist"` segmented control with roving tabindex — the third instance of a pattern the codebase ships twice already. Seven tabs. Horizontally scrollable below 640 px. The active tab is `aria-selected` and carries the accent token.
- **Metric selector:** a small `<select>` beside the chart, populated from the active category's `metrics`. Hidden when there is only one.
- **Range:** `7d · 30d · 90d · All`, default All.
- **Chart** (hand-rolled SVG):
  - Raw points as dots; a rolling average as the emphasised line, window = `clamp(round(n / 10), 3, 20)`.
  - Personal records marked with a distinct glyph and named in the accessible table.
  - The y-axis **inverts** for lower-is-better metrics, and the axis label says `lower is better`.
  - Above `aggregateAbove` (400) points, bucket by **local** day, plot bucket means, and say so: `Showing daily averages — 1 240 runs.`
  - Points sharing an `atMs` keep insertion order. The x-axis is real time, not an index.
- **States:**
  - *Loading* — the server snapshot is empty, so a skeleton renders until hydration (the `isHydrated` gate `GameShell` already uses at `:131`).
  - *Empty* — `No Speed runs yet.`
  - *Insufficient* — below `minimumDataPoints`: `2 of 3 runs needed to show a trend.` The runs still appear in the list below.
- **Accessibility:** `role="img"` with an `aria-label` summarising the trend, plus a visually-hidden `<table>` of every plotted point. No path animation under `data-reduced-motion="true"` — **both halves**, per the established convention (`globals.css:52-55`, asserted in `design.spec.ts:52-69`).
- **Persistence:** category, metric, and range write to `settings.stats`, surviving reload and session.

### 7.9 The three flows

**Standard scored run** — unchanged through completion; the result card now also shows the fastest path and the route comparison, and the run now writes a `RunRecord` that feeds both Recent Runs and the graph.

**Assisted run** — `Start → ? → confirm → assist: "revealed"` (badge, aria-live, muted timer) `→ panel opens → complete → RunRecord{assist:"revealed"} → no PB, no session record → learning card → Recent Runs with an Assisted badge → excluded from the graph.`

**Hotkey Mode run** — `Choose Hotkey → queue filtered to keyboard-complete drills → objective shows the optimal action count → commands captured with via/chord → validate end state → compareRoute → purity and efficiency → PB banked only if pure (per hotkeyStrictness) → result card leads with the route.`

---

## 8. Statistics and eligibility policy

### 8.1 The run-classification matrix

| Run type | Written to log | Recent Runs | Updates PB | In perf graph | Practice activity |
|---|---|---|---|---|---|
| Valid normal completion | Yes | Yes | Yes | Yes | Yes |
| Valid Hotkey completion, **pure** | Yes | Yes | Yes — Hotkey book only | Yes — Hotkey category only | Yes |
| Valid Hotkey completion, **impure** | Yes | Yes, flagged | **No** (at `strict`/`ranked`) | **No** — the category requires purity | Yes |
| Assisted completion | Yes | Yes, `Assisted` badge, no time | No | No | Yes |
| Failed run (finished, incomplete) | Yes | Yes, `Failed` flag | No | No | Yes |
| Expired (timed buzzer) | Yes — inside the session record | Yes (the session row) | Session record only | Yes | Yes |
| Abandoned run | **No** | — | No | No | No |
| Restarted run | **No** — only `attempts` carries onto the eventual completion | — | No | No | No |
| Suspicious run | Yes, `integrity: "suspect"` | No | No | No | No |

**Abandoned and restarted runs are not written.** This is what the code already does (`retry()` resets and records nothing, `useGameRun.ts:100`), it keeps the log clean, and it dissolves a class of "is a 2-second abandon a failed run?" ambiguity. The signal that would be lost — *how many attempts before you got it* — survives as `attempts` on the record that is written.

### 8.2 Personal-record isolation

PBs key on `${challengeId}:${mode}`, and a generated `challengeId` is already `${templateId}@${templateVersion}:d${difficulty}`. Therefore, **by construction, with no new code**:

- Sprint 5 cannot overwrite Sprint 10 (a separate book, keyed by mode and difficulty).
- Hotkey cannot overwrite Speed (a different `mode` segment).
- Difficulty 2 cannot overwrite difficulty 3 (a different `challengeId`).
- A template version bump starts a fresh book — deliberately (`DECISIONS.md:63`).

**Challenge-version comparability:** the record stores `challengeVersion`. The PB books are already isolated by it, and the graph plots score, which is target-normalised — so a version bump does not break the trend line. Storing the version makes "exclude superseded versions" a future query change rather than a schema change.

**The one new PB rule** — in Hotkey Mode, per `hotkeyStrictness`:

| `hotkeyStrictness` | Pointer input | Hotkey PB |
|---|---|---|
| `encouraged` | allowed | banked regardless of purity |
| `strict` *(default)* | allowed | **banked only when `keyboardShare === 1`** |
| `ranked` | blocked in-run | banked (purity guaranteed) |

---

## 9. Migration strategy

### 9.1 What exists to migrate

One key: `excel-speed-trainer:v1:run-history`, holding a `ProfileState` with at most 50 `RunHistoryEntry` rows plus lifetime totals. **The other three books are not touched by this plan at all** — personal records, session records, and settings keep their keys, shapes, and contents.

### 9.2 Can old runs be mapped to a category? Yes, exactly.

`RunHistoryEntry.modeKey` already holds precisely `"main-speed" | "practice" | "sprint-5" | "sprint-10" | "timed-30" | "timed-60"` — the six category ids, one for one. An unrecognised `modeKey` (hand-edited storage, or a removed mode) maps to `categoryId: null` and is **kept in the log, shown in Recent Runs, and excluded from every chart.** Excluded, not guessed.

### 9.3 Can old runs be considered ranked? Yes — and it is a fact, not an assumption.

The v1 schema has no assist field because **the help button did not exist.** No code path could reveal a hint during a run: `PracticeNotes` is reachable only from inside the result card, and a test pins that (`IMPLEMENTATION_PLAN.md:654`, `CHANGELOG.md:76`). Therefore no legacy run can have been assisted, and legacy runs are safely `assist: "none"`.

This is worth stating precisely, because "unknown eligibility defaults to excluded" would otherwise be the conservative call. Here the unknown is *knowable from the codebase's own history*, so inclusion is the honest answer.

### 9.4 Conservative where it matters: PBs are never re-derived

The migration **never writes to the personal-record or session-record books.** They are already correct, and re-deriving PBs from a 50-row window would be strictly worse than what is banked. Legacy records get `schemaVersion: 1` → `countsForPersonalBest: false`, which does not mean "this run never set a PB" — it means "this log entry is not a source for PB derivation". The existing books remain the source.

### 9.5 The migration, step by step

Runs once, inside `runLog.read()`, when the log key is absent and `run-history` is present.

1. **Back up first.** `run-history:v1` is **left in place, untouched.** It *is* the backup. It is removed only in a later release, after a version has shipped with the log working. If the log ever fails to parse, the reader falls back to the v1 profile and the app still works.
2. **Map every entry** (up to 50) → `RunRecord`, `schemaVersion: 1`:
   - `id`, `at` carried; `atMs = Date.parse(at)`; an unparseable date drops the row.
   - `modeKey` carried; `categoryId` resolved or `null`.
   - `label` carried. `challengeId`, `challengeVersion`, `templateId`, `difficulty`, `seed` → `null` (v1 never stored them).
   - `family` → best-effort from the classic-title map `ProfilePanel` already uses (`ProfilePanel.tsx:31`). **This is that hack's last use;** new records store `family` outright.
   - `score`, `elapsedMs`, `completed`, `tasksCompleted`, `isNewRecord` carried.
   - `outcome = completed ? "completed" : "failed"`.
   - `targetMs` and every route field → `null`.
   - `assist: "none"` (§9.3), `integrity: "ok"`, `attempts: 0`, `eventDigest: null`.
3. **Preserve the totals the cap destroyed.** v1's `totalRuns` counted every run ever, including trimmed rows. Store `priorTotals.runs = max(0, v1.totalRuns − importedRows)`, likewise for tasks. Displayed totals are `priorTotals + rollups + runs`, so nothing is double-counted.
4. **Malformed storage:** reuse the existing per-entry type-guard pattern (`runHistory.ts:77-95`). A bad row is dropped; a bad blob yields an empty log; a throwing storage yields an empty log. The game never crashes over history (`storage.ts:12`).
5. **Write** the log. **The presence of the log key is itself the "already migrated" flag** — no separate marker.

### 9.6 What the player sees

A one-time, dismissible note on `/profile`: *"Runs from before this update are limited to your last 50. Your totals and records are unchanged."*

### 9.7 Retention and scale

- Below `RUN_LOG_LIMIT` (5 000): every run kept verbatim. No aggregation. That is years of daily play.
- At the limit: the **oldest** runs fold into `RunRollup` daily buckets (`{ day, categoryId, runs, meanScore, bestScore, meanPaceIndex, tasksCompleted }`) — **except** any run with `isNewRecord`, which is kept verbatim so PB markers never vanish from the chart. Nothing is deleted outright.
- The chart plots rollups as a lower-resolution prefix of the same series. A rollup is shaped exactly like the day-buckets the pipeline already produces above 400 points, so there is no second rendering path.
- Specified now, **built in Phase 10**, so the schema never has to change to accommodate it.

---

## 10. Testing strategy

Conventions to follow, taken from the existing suite: co-located `*.test.ts(x)`; domain tests inject `createMemoryJsonStorage()`; component tests use the `vitest.setup.ts` localStorage shim and clear it in `beforeEach`; queries are role-first, `data-testid` reserved for readouts; e2e pins determinism with `?template=&seed=&difficulty=` and `?sessionSeed=`; test names are full sentences about product behaviour.

### 10.1 Unit

**Command layer**
- `Ctrl+↓` and `Cmd+↓` both map to `JUMP_DOWN`.
- `matchChord` returns null for an unbound key, and **specifically for `Alt+←`** (the browser-history hazard).
- `Ctrl+Shift+4` matches by `code` on a layout where `key` is not `"4"`.
- `resolveCommand` returns `null` for a command the grid cannot perform; the reducer's no-op identity keeps it out of the event log.
- `chordLabel("FORMAT_CURRENCY", "mac")` reads `Ctrl + Shift + 4` and carries the screenshot note.
- **Exhaustiveness:** every `GridCommandId` has an entry in `COMMAND_REGISTRY`, either with `chords.length > 0` or explicitly `chords: []` with a `reserved` note. Adding a command without deciding this fails the build (`Record<GridCommandId, CommandDefinition>` cannot compile with a missing key).

**Route solver**
- Solves one challenge of each family at or below its known optimum.
- Returns *all* shortest routes when two tie.
- Returns `null` past the node budget rather than hanging.
- **The load-bearing assumption test: no validator reads its `run` argument** — solving with a synthetic run equals solving with a real one.
- Regression tests for the four known-wrong authored notes: the solver's route for `gen.navigation.first-in-column` does **not** contain `JUMP_UP`; its route for `gen.formatting.bold-column` is 2 commands, not 3.
- Registry: every authored route (a) solves its challenge when replayed, and (b) is **no longer than the solver's optimum**.

**Route comparison**
- `4 × MOVE_DOWN` collapses for display and flags a missed `JUMP_DOWN` saving 3 actions.
- A player taking shortest-route B is 100% efficient even though route A is displayed.
- Group steps in either order both match.
- `optimal 5 / player 8 → extra 3, efficiency 63%`.
- A toolbar sort yields `toolbar-instead-of-chord`; a **keyboard-activated** toolbar button still counts as keyboard for purity.
- Events without a `command` → `confidence: "low"`, no route diff.

**Eligibility** — the highest-value file in the plan.
- Normal completion → all five flags true.
- Assisted → PB false, stats false, leaderboard false, recent true, practice true.
- Assisted-then-hidden → **still assisted** (monotonic; hiding is a view concern).
- Help opened after the timer started → still assisted (there is no other case: the clock starts before any input is possible).
- Failed → recent true, PB and stats false.
- Suspect → all false.
- Legacy (`schemaVersion: 1`) → PB false, stats true.
- Hotkey impure at `strict` → no PB; at `encouraged` → PB.

**Run log**
- `selectRecentRuns` returns exactly 20, newest first, from a log of 21 — **and the 21st is still in the log.**
- `selectEligibleForStats("speed")` excludes assisted, failed, and suspect; includes legacy.
- `selectTotals` = `priorTotals + rollups + runs`, with no double counting.
- Malformed rows dropped; malformed blob → empty log; throwing storage → empty log.

**Migration**
- A v1 profile with 50 entries and `totalRuns: 137` → 50 records and `priorTotals.runs === 87`.
- Every migrated record is `schemaVersion: 1`, `assist: "none"`, `targetMs: null`.
- An unknown `modeKey` → `categoryId: null`; appears in Recent Runs, in no chart.
- **The v1 key is still present after migration.**
- Running the migration twice is a no-op.

**Categories and series**
- Every `PerformanceCategoryId` has an entry; every entry's `modeKeys` are non-empty and **disjoint** from every other's.
- A `sprint-5` run never appears in the `speed` series.
- `paceIndex.lowerIsBetter === true`, and the chart's y-axis inverts for it.
- A run with `targetMs: null` is excluded from a `paceIndex` series but present in a `score` series.
- 2 points against `minimumDataPoints: 3` → the *insufficient* state, not the *empty* one.
- The rolling-average window scales with n and is stable at n = 1.
- Bucketing above 400 points produces one point per local day, and PB runs survive bucketing.

**Platform labels** — `getPlatform` is injectable; both label sets are asserted without touching `navigator`.

### 10.2 Integration (Testing Library, whole-shell)

- Complete an eligible Speed run → PB banked, row in Recent Runs, point on the graph.
- **Open help mid-run, then complete → PB unchanged, row present with an Assisted badge, graph unchanged.** One test, three assertions — the feature's central contract.
- Help revealed, panel hidden, run completed → still unranked.
- Retry after an assisted run → the new attempt is ranked again.
- A 21st run pushes the oldest row out of Recent Runs **while `selectTotals` still counts it** — the row left the window, not the log.
- Switching graph category updates the series **without unmounting the surrounding page** (assert the totals node is the same element before and after).
- **The fastest-path card's own steps, replayed through the reducer, complete the challenge the card is attached to.** If the card ever lies, this fails.
- Hotkey Mode records semantic actions: drive with `Ctrl+Shift+↓`, assert the recorded `command` is `EXTEND_JUMP_DOWN`, not merely `keyboard`.
- Hotkey Mode with one mouse click at `strict` → the run completes, scores, and banks **no** PB.
- `ranked` → a grid click produces no event at all.

### 10.3 End-to-end (Playwright)

- **Standard run** — extend `main-speed.spec.ts`: the fastest-path card renders with numbered steps and a chord label.
- **Assisted run** — `?template=…&seed=…`, press `?`, confirm, assert the `UNRANKED` badge and the aria-live text, solve, assert no time on the card and that `best-time` in the header is unchanged after a reload.
- **Hotkey run** — solve entirely with `page.keyboard.press`, assert purity `100%` and a PR; repeat with one `page.mouse.click` and assert no PR.
- **Sort-filter by keyboard only** — the Phase 2 acceptance test: solve `gen.sort-filter.filter-equals` with zero mouse events.
- **Recent Runs** — 21 seeded runs; exactly 20 rows; the footer reads `latest 20 of 21`.
- **Graph category switching** — the chart's `aria-label` changes; the totals tiles do not remount.
- **Persistence after refresh** — log, graph, and category selection all survive.
- **Platform presentation** — assert the Windows labels on Chromium. The macOS branch is covered by the injectable unit test; Playwright cannot fake the platform convincingly, and pretending otherwise would be a fake test.

### 10.4 Non-functional

- **Scale:** seed 5 000 records; `/profile` renders under 500 ms, the series pipeline under 50 ms, and the chart has bucketed to daily.
- **Storage:** seed until `setItem` throws; the game still plays and the run is still scored for the session. (`storage.ts:38` already promises this; this test holds it to it.)
- **Timing:** the command layer adds no frame — `dispatch` still performs exactly one reducer call per input, and `compareRoute` over a 200-event run runs in under 10 ms.
- **Keyboard latency:** `solveRoute` is never called while `status === "running"` unless help was revealed.
- **Accessibility:** the chart exposes `role="img"` with a non-empty label and a hidden data table; the category tablist is arrow-navigable; the help panel is keyboard-reachable and announces once; every new control has an accessible name.
- **Reduced motion:** with `data-reduced-motion="true"`, the chart's line has no animation **name** (not merely a zero duration) — the same two-part assertion `design.spec.ts:52-69` already makes.
- **Responsive:** at 375 px the help panel is a drawer below the grid, the grid has not moved, and the tablist scrolls rather than wrapping into the chart.

---

## 11. Phased implementation plan

Ten phases. Each ends green (`npm run lint && npm run typecheck && npm test && npm run e2e`) and each is a single revertable commit.

The brief's recommended order is followed with **one change: the missing keyboard commands (Phase 2) come before the route registry.** A fastest-path system built while sort, filter, and the date format have no keyboard route would emit routes that say "click the toolbar", and Hotkey Mode would have to exclude two of five families. Fix the engine's keyboard coverage first; then the routes are honest by construction.

---

### Phase 0 — Baseline and doc reconciliation

**Objective.** Make the docs describe the code, so the migration story is readable against a truthful baseline.

**Changes.** `README.md` (still says the app is not scaffolded), `ARCHITECTURE.md:3,444` ("designed, not built" — it is built), `CURRENT_STATE.md:98,100` (session records are `v2`; sessions no longer run `challenges[N % 23]`), `DECISIONS.md:20,111,136` (stale banners), theme count 16 → 13 in four places, `TODO.md` (sound shipped). Write the session-record `v2` decision entry that `IMPLEMENTATION_PLAN.md:1025` promised and nobody wrote.

**Tests.** None — documentation only.
**Acceptance.** No tracked doc contradicts the code on storage keys and versions, mode names, theme count, or what is built.
**Dependencies.** None. **Risk.** None. **Rollback.** Revert.

---

### Phase 1 — Semantic command layer

**Objective.** Every player input is named before it becomes a grid action. **No behaviour changes.**

**New.** `domain/commands/{commandTypes,commandRegistry,keymap,resolveCommand}.ts` (§1a.3 — one registry, not `keymap.ts` + `commandCatalog.ts`); `lib/platform.ts`.
**Changed.** `domain/runs/runTypes.ts`, `domain/runs/eventDigest.ts` (`v2`), `components/grid/SpreadsheetGrid.tsx`, `components/game/Toolbar.tsx`, `hooks/useGameRun.ts`, `components/game/RunFeedbackLayer.tsx`.

**Tasks.**
1. Define `GridCommandId`, `ActionMeta` (§1a.2 shape: `command`/`inputMethod`/`via`/`chord`/`controlId`, `ActionSource` including `"unknown"`), `ActionVia`, `Chord`, `CommandDefinition`.
2. `COMMAND_REGISTRY` covering every `GridCommandId` reachable today (the nine shipped chords, all nine toolbar buttons including `FORMAT_DATE`, and the four pointer-grid commands) with `windows`/`mac` labels where a chord exists. `OPEN_FILTER_MENU` alone is `chords: []`, `reserved: "Phase 2"`. No new chords yet.
3. `matchChord(event)` and `resolveCommand(command, context)` — `resolveCommand` is the single place a `GridCommandId` becomes a `GridAction`, reused unchanged by the Phase 4 solver; it takes `{grid, focus, anchor}` rather than `grid` alone, because the selection anchor a `Shift`-extend needs is tracked in `SpreadsheetGrid`'s own refs, not in `GridState` (the reducer normalises a range's start/end and loses which end the player is moving — confirmed at `gridReducer.ts`'s `select-range` case).
4. Rewire `SpreadsheetGrid.handleKeyDown` to those two functions. It becomes a dispatcher.
5. Rewire pointer paths and toolbar buttons to emit commands.
6. Thread `ActionMeta` through `useGameRun.dispatch` into `RunEvent`.
7. **Delete `shortcutLabelForEvent`;** the label comes from `chordLabel(event.command, platform)`.

**Tests.** The Command-layer block in §10.1, plus: **every existing test passes unchanged.** That is the phase's real acceptance criterion.
**Acceptance.** `Ctrl+Shift+↓` records `EXTEND_JUMP_DOWN`; a toolbar Bold click records `APPLY_BOLD` with `via: "toolbar"`, distinct from `Ctrl/Cmd+B`'s `TOGGLE_BOLD` (§1a.9 — they are different operations and must not share a command id); the shortcut-efficiency number is unchanged; every test passes, per the corrected criterion in §1a.8 (intentional migration of assertions describing `onAction`/`dispatch`'s second argument and the deleted `shortcutLabelForEvent`'s label — no assertion weakened or dropped).
**Dependencies.** Phase 0 (soft). **Risk.** This touches the game's hot path — mitigated by keeping the resolved actions byte-identical and letting the existing keyboard suite prove it. **Rollback.** Revert; the new `RunEvent` fields are optional and nothing persisted them.

---

### Phase 2 — Complete the keyboard command set

**Objective.** Every action the game can perform has a keyboard route. Without this, Hotkey Mode is a lie.

**New.** `components/grid/FilterMenu.tsx` — a `role="listbox"`: Sort A→Z, Sort Z→A, Filter to *value*, Filter above *value*, Clear. Arrows navigate, `Enter` applies, `Escape` closes, **focus returns to the grid**.
**Changed.** `keymap.ts` (`+Alt+↓`, `+mod+Shift+L`, `+Ctrl+Shift+3`), `SpreadsheetGrid.tsx`, `Toolbar.tsx`, `ColumnHeader.tsx` (a caret opens the same menu by mouse — parity).

**Tasks.**
1. Bind `FORMAT_DATE` to `mod+Shift+3` (label: Ctrl only), with the macOS-screenshot note, matching `FORMAT_CURRENCY`/`FORMAT_PERCENT` exactly (§1a.10). Amend `DECISIONS.md` to document all three screenshot-colliding chords (`Ctrl+Space` plus the `Shift+3/4/5` family) in one place.
2. Confirm the macOS **labels** for `Ctrl+Shift+4`/`5` — already `ctrlOnly` in Phase 1's `commandRegistry.ts`; no code change, just verification.
3. Build `FilterMenu`; bind `Alt+↓` to `OPEN_FILTER_MENU`. **Never bind `Alt+←`/`Alt+→`.** `matchChord` gains the specificity rule §1a.2 called out (a chord that constrains `alt` wins a tie over one that doesn't).
4. Add `TOGGLE_FILTER`, bound to `mod+Shift+L`: `resolveCommand` returns `clear-filters` when `grid.filters.length > 0`, else `filter-column` on the active cell's value (§1a.10 — a new command, not a shared chord on two existing ones).
5. **Return focus to the grid after every toolbar and menu command** (§2.3, fact 3), so a hybrid route does not go dead mid-run. The menu needs no explicit refocus (§1a.10 — it never takes focus from the grid); the toolbar gets a `gridFocusRef` prop, wired from `ChallengeRun`/`SessionRun` into `SpreadsheetGrid`'s existing `focusRef`.
6. Gate all of it by `challenge.allowedActions`, exactly as `set-format` already is (`SpreadsheetGrid.tsx:177`, `DECISIONS.md:239`): `FORMAT_DATE` already routes through the existing `set-format` gate; `TOGGLE_FILTER` and `FilterMenu`'s own options are newly gated the same way, by `sort-column`/`filter-column`/`clear-filters`.
7. Widen `hotkeyEligible`'s derivation and unify it with `KEYBOARD_COMMANDS` (§1a.10) — still fully derived, never hand-set.

**Tests.** All five families solvable with zero pointer events (five tests, replayed through the real reducer and the real validator per §1a.6). The menu is arrow-navigable; `Alt+↓` opens it and does not also fire `MOVE_DOWN`. `Alt+←` is not bound. A blank active cell disables `FILTER_TO_VALUE`/`TOGGLE_FILTER`'s filter branch, matching the toolbar's existing rule (`Toolbar.tsx:62`). `APPLY_BOLD`-style regression: `TOGGLE_FILTER` reproduces `clear-filters` vs `filter-column` correctly from either grid state. E2E: solve a sort-filter drill with no mouse.
**Acceptance.** `keyboardComplete` is true for all 21 seeded templates and all 23 classics.
**Dependencies.** Phase 1. **Risk.** A new chord collides with a browser or OS shortcut — mitigated by the enumeration in §5.2 and by manual checks on Chrome/Firefox/Safari across Windows and macOS. **Rollback.** Revert; the toolbar routes are untouched and everything still plays.

---

### Phase 3 — Canonical run model, run log, eligibility policy, migration

**Objective.** One source of truth for history, one function that decides what counts.

**New.** `domain/runs/{runRecord,runEligibility,runLog,migrateRunHistory}.ts`; `hooks/useRunLog.ts`.
**Changed.** `hooks/useGameRun.ts`, `GameShell.tsx`, `SessionRun.tsx`, `ProfilePanel.tsx` (reads the log; **the visible page does not change yet**).
**Retired.** `domain/profile/runHistory.ts` becomes read-only, used by the migration alone.

**Tasks.**
1. `RunRecord` + type guards. Route fields nullable, null until Phase 5.
2. **`getRunEligibility` — write its tests first.** This function is the product. Its input is the four fields it reads, not a whole record (§1a.11).
3. The `runLog` store (`useSyncExternalStore`, empty server snapshot — the established pattern) + the four selectors.
4. `migrateRunHistory`, **leaving `run-history:v1` on disk**.
5. Repoint `useGameRun`'s PB gate at the policy.
6. Repoint `ProfilePanel`'s totals at the log. It keeps its 50-row list until Phase 8's `RecentRuns` lands (§1a.11) — the acceptance below is that the page renders *identically*.
7. `domain/stats/categories.ts`, registry only, so `categoryId` can be denormalised at write time. `METRICS` waits for Phase 9 (§1a.11).

**Tests.** The Eligibility, Run-log, and Migration blocks. Integration: a completed run lands in the log with the right `categoryId` and `family`; the profile's totals are identical before and after migration.
**Acceptance.** The profile page renders identically, from a different store, with the old key still on disk.
**Dependencies.** Phase 1 (for `family` and `targetMs` at the write site). **Risk.** Data loss — mitigated by never deleting v1 and by a two-way test (migrate, then assert the derived totals equal the v1 totals). **Rollback.** Revert; v1 is intact and authoritative again.

---

### Phase 4 — Route registry and solver

**Objective.** Given a challenge, produce its optimal keyboard route(s). No UI.

**New.** `domain/routes/{routeTypes,solveRoute,routeRegistry,routeCache}.ts`.

**Tasks.**
1. `KEYBOARD_COMMANDS`, derived from the keymap so it cannot drift from what the game accepts.
2. `solveRoute`: BFS, canonical-signature visited set, depth and node budgets, all shortest routes.
3. Composite handling: leaf by leaf, labelled "a fast route".
4. `routeRegistry` with authored overrides — **start empty**; the solver covers everything today.
5. `routeCache`, memoised on `${challenge.id}:${challenge.seed}`.
6. The assumption test: **no validator reads `run`.**
7. The four regression tests against the known-wrong authored notes (§10.1).

**Tests.** The Route-solver block, plus a performance test: the solver completes in under 50 ms for every shipped template at every difficulty (table-driven over `generatedTemplates` × `[1..5]`).
**Acceptance.** Every generated variant and every classic yields a route, or an explicit `null` with a budget reason.
**Dependencies.** Phases 1, 2. **Risk.** Search blow-up on a future family — bounded by the node budget and the honest `null`. **Rollback.** Revert; nothing consumes it yet.

---

### Phase 5 — Post-run fastest path and route comparison

**Objective.** Every completed run explains the fastest route and how the player compared.

**New.** `domain/routes/compareRoute.ts`; `hooks/useFastestPath.ts`; `components/game/{FastestPathCard,RouteComparisonRows}.tsx`.
**Changed.** `ResultCard.tsx` (new sections; **the guessed `retryFocus` heuristic is deleted**), `useGameRun.ts` (populate the record's route fields), `SessionResultCard.tsx` (aggregate purity + the worst task's misses).

**Tasks.**
1. `compareRoute` and its three detectors.
2. `useFastestPath` — lazy, memoised, **never during a live scored run**.
3. `FastestPathCard`: platform-resolved chords, the tie-break route toggle, the mouse route collapsed (and honestly absent for `formatting.unbold-header`), the honest empty state.
4. Populate `optimalActions`, `routeEfficiency`, `keyboardShare`, `routeId` on the record.

**Tests.** The Route-comparison block; the integration test that **replays the card's own steps through the reducer and asserts completion**; the latency test that the solver never runs on the input path.
**Acceptance.** The brief's example renders: ordered steps, optimal 5, yours 8, extra 3.
**Dependencies.** Phases 1–4. **Risk.** Card noise on a 40-action run — mitigated by capping the missed-shortcut list at three, ranked by actions saved. **Rollback.** Revert.

---

### Phase 6 — Help control and assisted runs

**Objective.** Reveal the fastest path mid-run, at the cost of the run's ranking.

**New.** `hooks/useAssist.ts`; `components/game/{HelpPanel,UnrankedBadge}.tsx`.
**Changed.** `ChallengeRun.tsx`, `SessionRun.tsx`, `useGameRun.ts`, `ResultCard.tsx`, `themes.ts` + `SettingsPanel.tsx` (the `help` category).

**Tasks.**
1. `useAssist` — monotonic per attempt, reset by retry.
2. The control's four states (§7.1) and the `?` handler, on the run surface, **not** in the grid.
3. The reserved rail; the sub-1024 px drawer.
4. `UnrankedBadge`, the single aria-live announcement, the muted timer.
5. Thread `assist` into the `RunRecord`. **Assert the PB path is skipped by the policy, not by a new inline check.**
6. `settings.help.autoRevealInPractice` and `confirmBeforeReveal`.
7. In a session, revealing help assists the **whole session** — no session record.

**Tests.** The three-assertion central contract; hide-after-reveal stays unranked; retry restores ranking; the E2E assisted flow; the responsive drawer.
**Acceptance.** Opening help destroys the ranking of that attempt and nothing else, and the player is told once, unmistakably.
**Dependencies.** Phases 3, 4, 5. **Risk.** Accidentally unranking a PB run — which is precisely why the confirmation exists. **Rollback.** Revert; runs are simply never assisted.

---

### Phase 7 — Hotkey Mode

**Objective.** A ranked, keyboard-only mode with its own record book.

**New.** `domain/routes/hotkeyEligibility.ts`.
**Changed.** `challengeTypes.ts`, `personalRecords.ts`, `GameShell.tsx`, `ChallengeRun.tsx`, `ResultCard.tsx`, `SpreadsheetGrid.tsx` + `Toolbar.tsx` (ignore pointer input at `ranked`), `themes.ts` + `SettingsPanel.tsx`, `categories.ts`.

**Tasks.**
1. Widen `ChallengeMode` to include `"hotkey"`. **Update the PR type guard to `"main-speed" | "practice" | "hotkey"`** — `personalRecords.ts:60` hardcodes `"main-speed" | "practice"` today; per §1a.1 (corrected), Practice keeps its existing record eligibility, so this edit only *adds* Hotkey, it does not remove Practice. A missed edit would silently drop every Hotkey PB on reload. It gets its own test.
2. The seventh mode button; filter the queue to keyboard-complete drills.
3. Purity gating per `hotkeyStrictness`; the `ranked` pointer block with its accessibility notice.
4. The route-first Hotkey result card.
5. **Delete `mousePolicy`** from `Settings`, `DEFAULT_SETTINGS`, `coerceSettings`, and `SettingsPanel`.

**Tests.** A pure keyboard run banks a Hotkey PB; the same run with one click does not (at `strict`); a Hotkey PB never appears in the Speed book; **a reload does not drop Hotkey records** (the type-guard test); `ranked` blocks pointer events; a keyboard-activated toolbar button keeps purity intact.
**Acceptance.** Hotkey PBs are isolated, purity is enforced honestly, and no mouse user is locked out of the rest of the game.
**Dependencies.** Phases 1, 2, 4, 5. **Risk.** `ChallengeMode` is load-bearing across records, history, and the shell — mitigated by the type-guard test and TypeScript's exhaustiveness. **Rollback.** Revert; the mode disappears and the record books are untouched.

---

### Phase 8 — Recent Runs

**Objective.** The latest 20, as a window, not as the history.

**New.** `components/profile/RecentRuns.tsx`.
**Changed.** `ProfilePanel.tsx`; `GameShell.tsx` (honour `settings.gameplay.defaultMode` — a two-line fix, done here because the mode list is finally complete).

**Tasks.**
1. `RecentRuns`, fed by `selectRecentRuns(log, 20)`. It cannot render 21 rows because it is never handed 21.
2. Columns, badges (`PR`, `Assisted`, `Failed`, `Pure`), and the `Showing the latest 20 of N` footer.
3. `family` and `difficulty` now come from the record — **delete `ProfilePanel`'s title-lookup hack** (`ProfilePanel.tsx:31-33,56`) and give mastery its real `shortcutEfficiency` instead of the hardcoded `0` (`:62`).

**Tests.** 21 runs → 20 rows, newest first, totals still 21. Assisted rows show `—` for time and carry the badge. Abandoned runs absent. E2E: the footer text.
**Acceptance.** The 20-limit is enforced in the selector, and no run is deleted to achieve it.
**Dependencies.** Phase 3 (and 5–7 for the badge data). **Risk.** Low. **Rollback.** Revert.

---

### Phase 9 — Performance graph and category filters

**Objective.** A trend over all eligible history, filtered by category.

**New.** `domain/stats/{categories,performanceSeries,rollingAverage}.ts`; `components/profile/{PerformanceChart,CategorySelector}.tsx`.
**Changed.** `ProfilePanel.tsx`; `themes.ts` + `SettingsPanel.tsx` (`settings.stats`).

**Tasks.**
1. The category and metric registries. **No component may contain a mode string** — a test asserts the registry is the only place they appear.
2. `buildSeries(log, categoryId, metricId, range)`: filter → project → sort → bucket-if-large → rolling average → PB markers.
3. The SVG chart: dots, average line, PB glyphs, inverted axis for lower-is-better, `role="img"` + hidden data table, reduced-motion opt-out.
4. `CategorySelector` as a roving-tabindex tablist, mirroring `LeaderboardShell`.
5. Persist the selection to `settings.stats`.
6. Empty, insufficient, and loading states.

**Tests.** The Categories-and-series block; switching category does not remount the page; E2E persistence across reload; the a11y assertions.
**Acceptance.** A player with 400 Speed runs and 30 Sprint 5 runs sees two different, correct, comparable trends, and no assisted run appears on either.
**Dependencies.** Phases 3, 8. **Risk.** A hand-rolled chart is fiddly — bounded by keeping it a line, dots, and markers, and nothing else. **Rollback.** Revert; the profile keeps Recent Runs.

---

### Phase 10 — Scale, retention, accessibility, QA

**Objective.** Survive thousands of runs, and prove it.

**Tasks.**
1. `RunRollup` and the daily fold above `RUN_LOG_LIMIT`, keeping PB runs verbatim.
2. The 5 000-run performance test and the quota-exhaustion test.
3. A full accessibility pass on the new surfaces: names, roles, focus order, the two-part reduced-motion assertion, the 375 px layout.
4. **Retire `run-history:v1` — only now**, one release after the log shipped.
5. Update `ARCHITECTURE.md`, `CURRENT_STATE.md`, `DECISIONS.md` (the platform-label amendment, the third single-modifier exception, the run-log decision, the `mousePolicy` deletion), `CHANGELOG.md`, `TODO.md`.

**Acceptance.** 5 000 runs render under 500 ms; a full quota does not break play; every new control has a name and a role.
**Dependencies.** All. **Rollback.** Per task.

---

## 12. Risks and unresolved limitations

1. **Client-side anti-cheat is not solvable and is not attempted.** `eventDigest` says so itself (`eventDigest.ts:54-64`). `event.isTrusted` is recorded and acted on by nothing: jsdom and Testing Library dispatch untrusted events, so gating on it would break the suite and stop no one. The only real verification is server-side replay of the deterministic validators, which needs a server, which does not exist. `integrity: "suspect"` is a hook that nothing sets in v1.

2. **Hotkey detection is exact for the input paths the app owns, and blind beyond them.** Because the command is minted at the input boundary, the app knows precisely which command fired and whether a key or a pointer fired it. What it cannot know: which *physical* key a remapped keyboard sent, or whether a macro produced the keystroke. The card therefore describes the **command**, never the player's fingers.

3. **Composite routes are near-optimal, not optimal.** Solving leaf by leaf can miss a globally shorter interleaved route. The UI says "a fast path" for composites, not "the fastest path".

4. **The solver can fail.** Past its budgets it returns `null` and the card says no path is recorded. Preferable to a plausible wrong answer, and it is the failure mode a future family (formulas, fill/paste) is most likely to trigger.

5. **A mouse route does not always exist either.** `formatting.unbold-header` has **no mouse-only solve** — the toolbar's Bold button always sends `{bold: true}` (`Toolbar.tsx:83`), so only `Ctrl/Cmd+B` can unbold. The card must be able to say "there is no mouse route", and the tests must cover it.

6. **`localStorage` is the only store, and it can be full, blocked, or wiped.** Writes are already best-effort (`storage.ts:38`). A 5 000-run log at ~1.5 MB is comfortable but not unlimited, hence the rollup. **Clearing browser data still destroys everything, and there is no export.** An export/import button is the cheapest possible insurance and is deliberately **not** in this plan — it should be the first thing added after it.

7. **History before this feature is capped at 50 runs, permanently.** Nothing can recover what the v1 cap already deleted. Existing players will see a short prefix, and the profile says so once.

8. **`ChallengeMode` is load-bearing in three stores.** Widening it touches the PR type guard (`personalRecords.ts:60`), which **silently drops records it does not recognise**. A missed edit there would delete every Hotkey PB on reload with no error. Hence its own dedicated test.

9. **New chords can collide with a browser, an OS, or an extension.** `Alt+←/→` (history) and `Cmd+Shift+3/4/5` (macOS screenshots) are enumerated and handled. Extensions are unknowable. The keymap being one data structure means a collision is a one-line fix rather than a hunt.

10. **The clock still does not pause when the tab is hidden** (`TODO.md:39`, an accepted consequence of `DECISIONS.md:282`). Help neither helps nor hurts this — but reading a fastest path *is* exactly the moment a player alt-tabs. Since assisted runs are unranked, the damage is contained. It is also a reason **not** to add a pause that only assisted runs could use.

11. **A local log cannot merge into an account without a rule.** `RunRecord.id` is client-minted and `eventDigest` is forgeable, so deduplication must key on `(id, atMs, eventDigest)` and a server must treat every imported run as unranked-but-counted. The schema carries what that migration will need; the policy for it is deliberately not written here.

---

## 13. Implementation handoff checklist

Work top to bottom. Do not start a phase until the one above it is green.

**Phase 0 — Baseline**
- [ ] Reconcile `README`, `ARCHITECTURE`, `CURRENT_STATE`, `DECISIONS`, `TODO` with the code (§2.9).
- [ ] Write the missing session-record `v2` decision entry.

**Phase 1 — Command layer**
- [ ] `GridCommandId`, `ActionMeta`, `ActionVia`.
- [ ] `COMMAND_REGISTRY` covering every reachable `GridCommandId`, with `windows`/`mac` labels where a chord exists.
- [ ] `matchChord`, `resolveCommand`, `KEYBOARD_COMMANDS`.
- [ ] `SpreadsheetGrid.handleKeyDown` becomes a dispatcher over the keymap.
- [ ] Toolbar and pointer paths emit commands.
- [ ] `RunEvent` gains `command`/`via`/`chord`; `eventDigest` → `v2`.
- [ ] **Delete `shortcutLabelForEvent`.**
- [ ] All 493 existing tests still pass, unchanged.

**Phase 2 — Keyboard completeness**
- [ ] `mod+Shift+3` → `FORMAT_DATE` (label: Ctrl only, matching `FORMAT_CURRENCY`/`FORMAT_PERCENT`; document the macOS-screenshot exception in `DECISIONS.md`).
- [ ] Confirm the macOS **labels** for `Ctrl+Shift+4`/`5` (already shipped in Phase 1).
- [ ] `FilterMenu` (`role="listbox"`), opened by `Alt+↓` and by a header caret; no focus/keydown of its own (§1a.10).
- [ ] `TOGGLE_FILTER`, a new command bound to `mod+Shift+L`, toggles filter/clear via `resolveCommand` (§1a.10 — not a shared chord on `FILTER_TO_VALUE`/`CLEAR_FILTERS`).
- [ ] **Never bind `Alt+←`/`Alt+→`.** `matchChord` specificity rule so `Alt+↓` doesn't also fire `MOVE_DOWN`.
- [ ] **Focus returns to the grid after every toolbar and menu command.**
- [ ] `hotkeyEligible`/`KEYBOARD_COMMANDS` widened to menu-reachable commands, still fully derived (§1a.10).
- [ ] All five families solvable with zero pointer events, replayed through the real reducer and validator.

**Phase 3 — Run model and policy**
- [ ] `RunRecord`, type guards, `RUN_LOG_KEY`.
- [ ] **`getRunEligibility` — write its tests first.**
- [ ] `runLog` + `selectRecentRuns` / `selectEligibleForStats` / `selectTotals` / `selectByMode`.
- [ ] `migrateRunHistory`; **leave `run-history:v1` on disk.**
- [ ] `useGameRun`'s PB gate calls the policy, not an inline check.
- [ ] The profile page renders identically from the new store.

**Phase 4 — Routes**
- [ ] `solveRoute` (BFS, visited set, depth/node budgets, all shortest routes).
- [ ] Composite = leaf by leaf, labelled "a fast route".
- [ ] `routeRegistry` + `routeCache`.
- [ ] The assumption test: **no validator reads `run`.**
- [ ] Regression tests against the four known-wrong authored notes.
- [ ] Solver under 50 ms for every template × difficulty.

**Phase 5 — Fastest path in results**
- [ ] `compareRoute` + the three missed-shortcut detectors.
- [ ] `useFastestPath` — **never runs during a live scored run.**
- [ ] `FastestPathCard`: platform-resolved chords, honest empty state, honest "no mouse route" state.
- [ ] Route fields populated on the `RunRecord`.
- [ ] **The card's own steps, replayed, complete the challenge.**

**Phase 6 — Help and assisted runs**
- [ ] `useAssist` — monotonic per attempt, reset by retry.
- [ ] Help control (4 states), `?` shortcut, confirmation step.
- [ ] Reserved rail; drawer below 1024 px; **the grid never moves.**
- [ ] `UnrankedBadge`, one aria-live announcement, muted timer.
- [ ] `settings.help.autoRevealInPractice` + `confirmBeforeReveal`.
- [ ] **Open help → complete → PB unchanged, row in Recent Runs, absent from the graph.**

**Phase 7 — Hotkey Mode**
- [ ] `ChallengeMode` gains `"hotkey"`; **update the PR type guard to `"main-speed" | "practice" | "hotkey"` (Practice keeps its book, per §1a.1) and test it.**
- [ ] Seventh mode button; queue filtered to keyboard-complete drills.
- [ ] `hotkeyStrictness` wired; **`mousePolicy` deleted.**
- [ ] Purity gates the Hotkey PB; `ranked` blocks the pointer, reversibly.
- [ ] A keyboard-activated toolbar button keeps purity intact.

**Phase 8 — Recent Runs**
- [ ] `selectRecentRuns(log, 20)`; the component is never handed a 21st row.
- [ ] Badges, columns, `Showing the latest 20 of N`.
- [ ] **Delete the title→family lookup hack**; mastery gets its real shortcut efficiency.
- [ ] `settings.gameplay.defaultMode` honoured.

**Phase 9 — Graph**
- [ ] Category + metric registries; **no mode strings in components.**
- [ ] `buildSeries`: filter → project → sort → bucket → rolling average → PB markers.
- [ ] SVG chart: inverted axis for lower-is-better, `role="img"`, hidden data table, reduced-motion opt-out.
- [ ] `CategorySelector` as a roving-tabindex tablist.
- [ ] Selection persisted to `settings.stats`.
- [ ] Empty / insufficient / loading states.

**Phase 10 — Scale and QA**
- [ ] `RunRollup` above 5 000 runs; PB runs kept verbatim.
- [ ] 5 000-run render test; quota-exhaustion test.
- [ ] Accessibility pass on every new surface; 375 px layout.
- [ ] Retire `run-history:v1`.
- [ ] Update every doc.

---

**Resolved (§1a.1).** Practice remains an ordinary record-eligible mode. Assistance — not mode identity — is what unranks a run: a Practice run with help never revealed may bank a Practice PB exactly like Speed; opening help (or starting with `autoRevealInPractice` on) unranks only that run, via the same `assist === "revealed"` rule every mode already uses. No fourth `Learn` mode is added — Practice already is that surface. See §1a.1 for the full decision.
