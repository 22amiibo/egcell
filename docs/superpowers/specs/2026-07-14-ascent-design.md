# Ascent — design spec

**Status:** approved (2026-07-14). Implementation plan: `docs/superpowers/plans/2026-07-14-ascent.md`.
**Baseline:** branch `fix/filter-header-anchor` at `c77c6a7` plus its working-tree changes. The code is the source of truth; where this spec disagrees with the code at implementation time, reconcile first and record the deviation in the plan's §1a addendum, per `docs/plans/HANDOFF-phase-4.md`.

---

## 1. Why

The stated fun gaps are **no mastery ladder** and **repetitive, same-y runs**. Exploration found three concrete causes:

1. **The game never gets harder.** `src/data/challenges/queue.ts:13-15` pins `SESSION_DIFFICULTY = 2` and `NORMAL_SPEED_DIFFICULTY = 2`. The five difficulty presets (`src/domain/challenges/difficulty.ts:25-76`) are fully built — bigger tables, distractor columns, confusable names, offset tables — and normal play never draws difficulty 1, 3, 4, or 5. The variety is built and switched off.

2. **There is no such thing as a mistake.** All four `ValidationResult` constructors hardcode `accuracy: 1` (`src/domain/validation/validatorTypes.ts:48,57,67,78` — the comment concedes it: *"Pinned at 1 until invalid-action tracking exists"*). Downstream, `accuracyMultiplier` is always exactly `1.0` (`scoreRun.ts:27`), `mistakes` is always `0` (`ChallengeRun.tsx:80`), live accuracy always reads 100%, and `combo` degenerates into the raw action count (`liveRunStats.ts:43`). `ComboIndicator` renders a number that means nothing and feeds nothing — `ScoreInput` has no combo field. And `calculateMastery` weights accuracy at 30%, so the mastery score is 30% constant.

3. **The game has no verb for producing a value.** No `<input>`, no commit path anywhere in `components/grid` or `domain/grid`. The `formula` family is declared (`challengeTypes.ts`) with a full `{kind:"formula"}` cell type and read/render support — and zero templates, because nothing can author one.

**Decisions taken with the product owner:** the new loop is a *flagship* mode — the seven shipped modes and their record books survive; cell editing/typing is in scope as a genuine new engine verb; **there is no fail state** — a run always ends on the clock, never on a death.

---

## 2. Ascent: the run loop

A run is a **fixed-clock climb**, not a queue to be emptied.

- One clock (default **90s**). It ends when the clock ends. Nothing else ends it.
- Tasks arrive one at a time, drawn live from the seeded template pool at the **current tier**.
- **Tier is `ChallengeDifficulty` (1–5)** — the ladder rung and the difficulty knob are the same number.
- Clear a task **under its target seconds** → `heat + 1`. At `heat === 3`, **tier up**, heat resets.
- Clear it over target (or skip, or get caught by the buzzer mid-task) → heat resets to 0. **The tier itself never drops.**
- Beyond tier 5 the run enters **overdrive**: each further promotion tightens every subsequent task's target by 10% (`× 0.9` per rung, floor 2s) instead of raising the tier. The ladder stays open-ended without inventing a sixth difficulty preset.

**The tier is a ratchet, and that is deliberate.** No lives, no demote, no early end — the clock is the only limiter, per the no-fail-state decision. A slow clear costs *heat* (the rate you are climbing at), never a rung already earned. This is a trainer; banking reps at your level is the point, and tier weighting already pays more for climbing than farming.

> *Implementation refinement:* an earlier draft made overdrive draw only composite/mixed drills. The pool has exactly one mixed template today, which would make overdrive a one-drill rut. Overdrive is target-tightening only; the pool is unchanged.

**The headline number is peak tier**, then score: *"Peak 4 · 18 tasks · 12,400."*

## 3. Scoring: tier-weighted, and combo finally pays

`scoreRun` is **not** rewritten — `basePoints × speed × correctness² × accuracy × completion` stays, and the target-time normalization stays (it is the settled answer to the brief's "normalize by max score" — see `DECISIONS.md`). Two additions:

- `ScoreInput` gains **`comboMultiplier`** (default 1, clamped to `[1, 1.5]`). Combo = consecutive tasks cleared under target with no wasted actions and no keystroke corrections; it grows `1.0 → 1.5` over five clears (`1 + 0.1 × min(streak, 5)`) and resets on a slow or dirty clear. The multiplier a task is scored with is the streak **entering** it.
- Ascent applies a **tier weight** on top: a task cleared at tier *t* with *o* overdrive rungs is worth `× (1 + 0.25·(t − 1 + o))`. Tier weighting lives in `domain/ascent/`, not in `scoreRun` — `scoreRun` stays the one shared, mode-agnostic formula.

**Where combo pays, and where it must not.** The multiplier applies only where no per-challenge personal record is banked: session tasks and Ascent tasks (both run with `recordPersonalBest: false`). A single-challenge PR fed by cross-task streak state would make `${challengeId}:${mode}` records incomparable — so Speed/Practice/Hotkey singles never see the multiplier, and their record books are untouched. Session scores shift with the combo, so **the session record book bumps its storage key to v3**, the same move v2 made when seeded queues changed the race.

## 4. Cell editing: the new verb

- **New `GridAction`: `{ kind: "set-cell-value"; cell: CellAddress; value: CellValue }`** — atomic commit only. The reducer never sees a keystroke; it sees a finished value. `gridReducer` stays pure and `(challenge, grid) → isComplete` stays a cheap goal test.
- **The edit buffer is a pure state machine outside the reducer** (`domain/grid/editing.ts`): `idle → editing(buffer) → committed | cancelled`, plus `parseCellInput` (number/text now, `=formula` in the next phase).
- **New commands** in `COMMAND_REGISTRY`: `START_EDIT` (`F2`, or any printable character on a cell — Excel's behavior), `COMMIT_EDIT` (`Enter`/`Tab`), `CANCEL_EDIT` (`Escape`). Only the commit dispatches an action and lands in the event log; `START_EDIT`/`CANCEL_EDIT` are `recordable: false` — they change no grid state.
- **Focus moves into the editor's real `<input>`**, and returns to the grid on commit/cancel. This deviates from the filter menu's focus-never-leaves-the-grid pattern deliberately: text entry needs a genuinely focused text field (IME, OS text services).
- **Keystrokes are recorded, not dispatched.** `ActionMeta` and `RunEvent` gain optional `keystrokes: { chars, corrections }` on the committing event. The event log stays a route log, not a keylogger.
- **The solver must never search over strings.** `solveRoute`'s BFS is sound only over a finite command set. Typing specs are excluded from BFS: the route is *navigate to the cell (BFS'd) + one authored `COMMIT_EDIT` step*. Edit commands are excluded from `KEYBOARD_COMMANDS`. A composite containing a typing leaf yields `null` (honest "no fastest path recorded") in v1.

## 5. Two mistake signals, kept distinct

1. **Route waste** — actions beyond the solver's optimum. Already computed post-run (`compareRoute`, stored as `RunRecord.routeEfficiency`); nothing *live* consumes it. It becomes live: it breaks combos. The per-task solve runs at task load, off the render path (a difficulty-5 solve costs up to ~500ms).
2. **Keystroke accuracy** — wrong/corrected characters against the target. The first real mistake the game can have; WPM falls out of it for free (`chars ÷ 5` per minute).

**`ValidationResult.accuracy` stays validator-pinned at 1.** Validators grade the grid's end state and never read the run — that invariant (`DECISIONS.md`) outranks the earlier draft of this spec, which had the validator report keystroke accuracy. Instead the run engine (`useGameRun.buildFinished`) computes keystroke accuracy from the event log and feeds it to `ScoreInput.accuracy` directly (`keystrokeAccuracy ?? validation.accuracy`). One number, one owner, no validator impurity. `mistakes` and live accuracy surfaces read the same sources.

## 6. The formula family, filled

With a commit path, `templates/formula.ts` becomes real: type-the-value data-entry drills and `=SUM(range)` / `=AVERAGE(range)` formula drills, graded by a new `cell-value` leaf spec (exact value) and a `formula` leaf spec (accepted normalized forms + computed value — a literal that happens to equal the total is called out, not passed). A tiny pure evaluator (`SUM/AVERAGE/MIN/MAX/COUNT` over one range, bare cell refs) computes `CellValue.computed` at commit time. Formula challenges allow only `select-cell` + `set-cell-value`, so recompute-after-sort staleness is unreachable in v1.

## 7. Command mastery, and the cheat sheet that doesn't exist

The registry holds a label and description for all 33+ commands and nothing renders them. The between-runs chase and the missing cheat sheet are the same screen: **Command Codex** on `/profile` — every command, its chord, its description, and a mastery level (`Unknown → Seen → Learned → Fluent → Reflex`) derived from a small persisted per-command stat (use count + EWMA of time-to-fire). Per-family peak tier sits above it.

## 8. Architecture

New domain modules (pure, tested as pure functions — the house pattern):

| Module | Holds |
|---|---|
| `domain/scoring/combo.ts` | combo state machine + multiplier curve (shared by sessions and Ascent) |
| `domain/ascent/ascentTypes.ts` / `ascentEngine.ts` | `AscentState`, `advanceAscent` — the entire ladder is one pure reducer |
| `domain/ascent/ascentScore.ts` | tier weight, overdrive target tightening |
| `domain/ascent/drawAscentTask.ts` | one seeded task at the current tier |
| `domain/grid/editing.ts` | edit-buffer state machine + `parseCellInput` |
| `domain/grid/formulaEval.ts` | A1 parsing + the five-function evaluator |
| `domain/validation/validateValue.ts` / `validateFormula.ts` | the two new leaf validators |
| `domain/challenges/templates/formula.ts` | the empty family, filled |
| `domain/stats/typingStats.ts` | keystroke accuracy, WPM |
| `domain/mastery/commandMastery.ts` | per-command stats + mastery levels |
| `domain/records/ascentRecords.ts` | the Ascent record book |

Extended in place: `GridAction`/`GridActionKind`, `GridCommandId` + `COMMAND_REGISTRY` + `resolveCommand`, `ScoreInput`, `RunEvent`/`ActionMeta` (keystrokes), `RunRecord` (`peakTier`, `wpm`, `keystrokeAccuracy` — nullable, missing-on-old-records normalized to null at read), `PERFORMANCE_CATEGORIES` (+`ascent`), `PLAY_OPTIONS`/`PlaySelection`.

Components: `game/AscentRun.tsx` (third run driver beside `ChallengeRun`/`SessionRun`), `game/TierMeter.tsx`, `grid/CellEditor.tsx`, `profile/CommandCodex.tsx`.

New storage keys: `excel-speed-trainer:v1:ascent-records`, `excel-speed-trainer:v1:command-stats`, plus the session-records bump to `v3`.

**Constraints that survive:** zero new runtime dependencies (`next`, `react`, `react-dom` only); `gridReducer` pure; validators never read the run; the solver never on the render path and never searching strings; storage local-only, every write best-effort.

## 9. Build order

- **Phase 0 — Stop lying.** Unpin Speed's difficulty (sessions stay at d2 — their record key carries difficulty and mixing would scramble the books); make route waste live (task-load solves) and consuming (combo breaks, honest `mistakes`); `comboMultiplier` into `ScoreInput`; combo pays in sessions (v3 record key). No new verbs. Independently shippable.
- **Phase 1 — The editing engine.** `set-cell-value`, the edit state machine, three commands, `CellEditor`, solver exclusion. No challenges use it yet.
- **Phase 2 — Things to type.** Value/formula validators + evaluator, the formula family, typing stats, keystroke accuracy joins the score. The first test asserting `accuracy ≠ 1` lives here — it cannot be written earlier.
- **Phase 3 — The ladder.** `ascentEngine`, `drawAscentTask`, `AscentRun`, `TierMeter`, Ascent as the first `PLAY_OPTIONS` entry.
- **Phase 4 — The record.** Ascent record book, run-log fields, `ascent` performance category.
- **Phase 5 — The chase.** Command mastery + the Codex.
- **Phase 6 — Calibrate.** The playtest-tuning pass open since the variant system (Phase I), now with a ladder to tune against.

## 10. Deliberately not in scope

Accounts, servers, a real leaderboard service, AI coaching, a UI redesign, retiring any shipped mode or record book, demotes/lives/fail states, recompute-on-sort for formulas, composite specs containing typing leaves, and the brief's "normalize by max-possible-score" (already answered better by target-time normalization).
