# Current State

Last updated: 2026-07-13

## Summary

**The plan's eight phases, the gameplay-expansion batch, and Challenge Variant System Phases A-H are complete.** The game now has six play modes, 23 classic challenges, generated drills across five families, full keyboard control, a local profile, and player-chosen themes.

The Core Game Feel + Settings upgrade is complete through **Task 12 of 12**. Grid density, gridline strength, and large-target settings now drive stable per-run spreadsheet geometry, and the final automated plus manual design QA pass is complete.

Open `/` and a run is already under way. Complete the challenge and it scores, banks a personal record, logs to the local history, and offers a retry or the next challenge.

## Core Game Feel Checkpoint (Tasks 1-12)

| Commit | Task |
| --- | --- |
| `97711ca` | Semantic design tokens and 13 original themes |
| `57ee973` | Expanded local settings model |
| `ca475a0` | Eight-category tuning panel |
| `c085a63` | Live EPM, accuracy, shortcut efficiency, and progress |
| `e422d8e` | Fixed practice frame and session progress rail |
| `f5761ea` | Feedback, combo, shortcut, and reduced-motion layer |
| `6da8b65` | Silent-by-default original synthesized run cues |
| `fb2a543` | Replay-focused single and session results |
| `9e0384b` | Local-only leaderboard shell and route |
| `bf2fad0` | Skill mastery and profile progression |
| `d61dbab` | Stable grid density, gridline, and large-target settings |
| `623e4a7` | Final keyboard, motion, focus, theme, and layout QA |

Latest verification: clean lint, 476 unit tests across 50 files, clean typecheck, successful production build, and 42 Chromium end-to-end tests. Manual QA passed at 1280×900 and 1366×768 in Ledger Noir and Paper Grid. The known inferred-workspace-root warning remains harmless.

## Play Modes

| Mode | What it is | Records |
| --- | --- | --- |
| Speed | One challenge, chase the time | Per challenge |
| Practice | Same, with route notes after the run | Per challenge, separate book |
| Sprint 5 / Sprint 10 | Fixed task queue under one clock, skip allowed | Per sprint length |
| 30s / 60s | Tasks keep coming until the countdown dies | Per duration |

Session queues are seeded, family-balanced, repetition-avoiding generated queues. The same seed and queue version reproduce the same tasks; session records key on mode and difficulty and chase score, not elapsed time. Tasks inside a session never bank per-challenge records.

## Challenges

The 23 classics remain in `src/data/challenges/index.ts`. Seeded templates now generate navigation, selection, formatting, sort/filter, and mixed variants from four dataset themes. A generated mixed drill composes two or three existing leaf validators on one dataset; its steps are intentionally order-independent and report named subgoals.

## Keyboard

The grid is fully playable without a mouse: arrows move, Shift+Arrow extends, Cmd/Ctrl+Arrow jumps to the edge of the data region (riding runs of data, crossing blanks, honouring hidden rows), Cmd/Ctrl+Shift+Arrow extends the jump, Ctrl+Space selects the column, Shift+Space the row, Cmd/Ctrl+A the table, Cmd/Ctrl+B toggles bold, Ctrl+Shift+4/5 apply currency/percent. Formatting shortcuts are gated by the challenge's `allowedActions`, exactly as the toolbar is. Cmd and Ctrl are both accepted; nothing sniffs the platform. The grid takes focus on mount and again on retry.

## Profile and Settings

- `/profile`: local mastery across eight professional skill families, focused practice recommendations, recent runs (capped at 50), totals, and best score/time per mode. Totals are folded in before the cap trims, so nothing earned is lost.
- `/leaderboard`: an accessible local/mock shell for daily, weekly, friends, global, skill, and ranked views. It shows personal bands and honest empty states; no live service or fake opponents exist.
- `/settings`: 16 theme presets, dark to light to high-contrast to terminal. A preset reassigns all nine design tokens as CSS variables on the document root; a boot script applies a saved theme before first paint. Local-only.

## Architecture Notes

- Domain stays pure and React-free: `domain/grid` (+ `keyboardNav`), `domain/challenges`, `domain/validation` (+ `validateComposite`), `domain/scoring`, `domain/records`, `domain/sessions`, `domain/profile`, `domain/settings`, `domain/runs`.
- Every validator still grades the grid's end state, never the route. The keyboard shipped without touching one.
- Generated variants and queues are pure functions of their seeds. A template emits its grid and validation spec from the same generated dataset layout.
- Composite validation reports each named subgoal while preserving the existing mean completion calculation and unchanged score pipeline.
- Client-only state (records, session records, history, settings, clocks) goes through `useSyncExternalStore`. Zero lint suppressions.
- `useGameRun` gained `recordPersonalBest`, `onFinished`, and `finishNow()` for sessions; the timed deadline is a per-task timeout **plus** a wall-clock check at completion, because setTimeout is a lower bound.

## What Works

All five gates pass:

- `npm run lint` — clean.
- `npm test` — 484 tests across 51 files.
- `npm run typecheck` — clean.
- `npm run build` — succeeds.
- `npm run e2e` — 42 Chromium tests (~39s; one real 30-second timed run).

## What Does Not Exist Yet

- No formula family. `CellValue` supports it; nothing creates one.
- No deployment, no accounts, no server, no real leaderboard. By design.
- Generated mixed content is deliberately narrow: one non-interfering sort-and-format template. Phase I still needs playtest tuning before the family grows.

## Challenge System Audit (2026-07-13, Phase A)

What the challenge system is, and exactly what stops it scaling to many randomised challenges. The design that fixes it is `ARCHITECTURE.md` § Challenge Variant Architecture; the work is Phases B-I of `IMPLEMENTATION_PLAN.md`. **Nothing below is broken.** These are ceilings, not defects.

**Families.** Six in the type (`navigation`, `selection`, `formatting`, `sort-filter`, `formula`, `mixed`); four carry content, `formula` is declared and empty.

**Challenge data model.** A flat literal: id, version, slug, title, prompt, family, difficulty 1-5, seed, timing policy, `initialGrid`, `allowedActions`, `validation`, `scoring`, `practiceNotes`. Two properties are load-bearing for what comes next and are already right: **`id` and `seed` are separate fields**, and `PersonalRecord` stores both — so a record can key to a drill while the instance varies.

**Grid state model.** Row/col counts, `usedRange`, `headerRows`, cells keyed `"r:c"`, `activeCell`, `selection`, `hiddenRows`, `sortState`, `filters`. Actions: select cell/range/row/column, set-format, sort-column, filter-column, clear-filters. Pure reducer; a sort moves whole rows and never the header; filters recompute from scratch after a sort.

**Validators.** One dispatcher (`validateChallenge`) switching exhaustively on `validation.kind`, never on an id. Four leaf validators plus a flat `composite`. All grade final grid state, never route. This is the layer needing the least change: a generated spec grades exactly as a hand-written one does.

**Scoring.** `base × clamp(target/elapsed, 0.2, 2) × correctness² × (0.75 + 0.25·accuracy) × completion`. Speed is normalised against **each task's own** `targetSeconds` — which turns out to be what can make a randomised sprint queue fair.

**Run modes.** Six: Speed, Practice, Sprint 5, Sprint 10, 30s, 60s. Sessions run `challenges[N % 23]` under one clock.

**Records.** Four localStorage books, all `v1`: personal records keyed `${challengeId}:${mode}`; session records keyed by mode; run history (capped at 50); settings.

### The Eight Limits

1. **One dataset.** All 23 challenges call `createRevenueGrid()` — 6 data rows, 5 columns, fixed values. Positions are memorisable; "Go to Dara's Units" decays into recall after a few plays.
2. **`seed` is decorative.** Every challenge carries one; nothing reads it. There is no RNG in the codebase, seeded or otherwise.
3. **Coordinates are module constants of one table.** `REVENUE_COL = 2`, `LAST_DATA_ROW = 6`, and every validation spec is written in terms of them. A generated grid with a different column order would silently invalidate every spec unless grid and spec are emitted **from one schema, in one call**. This is the most dangerous property of the current code and the rule the variant design is built around.
4. **Session queues are list slices.** `taskChallengeAt(pool, i) = pool[i % pool.length]`, chosen deliberately so a sprint record is not a lucky draw. It also pins the first eight challenges in order, makes inserting a challenge mid-list a change to what Sprint 5 means, and leaves queues unable to mix families or avoid repetition.
5. **Personal records would explode under naive generation.** The key is `${challengeId}:${mode}`. Give each generated variant a fresh id per seed and every run sets a first-ever PR, which kills the chase. Fix: key on template + difficulty, vary the seed. The types already permit this.
6. **Partial credit is coarse.** Only `validateFormatting` reports a fraction; navigation, selection, and sort/filter are binary. `validateComposite` averages its parts but never says *which* part is done, so a timed buzzer cannot tell the player what they got.
7. **Prompts are hand-written English tied to one table.** "Show Units above Bruno's" names a row that exists in exactly one dataset. Generated prompts must derive from the dataset's real headers, and something must prove the header named in a prompt is the column its spec grades.
8. **Three planned families are grid-blocked.** Structure edits, fill/copy, and formulas have no reducer actions, no clipboard model, and no evaluator. They cannot be added by writing challenges; each needs a reducer phase first.

### What Is Already Right

Stated because the temptation will be to rebuild it:

- The validator dispatcher is spec-keyed and exhaustive. **No new validator registry is needed.**
- `id` ≠ `seed`, and records store both. The PR-safety seam already exists.
- `scoreRun` normalises speed per task, so a varied queue can still yield comparable scores.
- `challenges.test.ts` already asserts the four things a generator must guarantee: unique identity, does-not-start-complete, allowed-actions-cover-the-solution, no-shortcut-in-prompt. It is the eligibility gate in embryo — promote it, do not rewrite it.

## Known Issues

None blocking.

- `npm install` leaves install scripts unapproved for `sharp` and `unrs-resolver` under npm 11. No gate cares.
- Next warns it inferred the workspace root as `/Users/noahmartz` (stray lockfile there). Warning only; do not set `turbopack.root`, it broke the React Client Manifest once already.
- `<html>` carries `suppressHydrationWarning` because the theme boot script styles it before hydration. That is the one element it is suppressed on.

## Next Best Step

**Phase I of the Challenge Variant System** in `IMPLEMENTATION_PLAN.md`: playtest and tune generated difficulty, target times, prompt clarity, and queue pacing. Phases B-H are implemented.

Open, unblocked, and off that path:

- **Playtest the sessions.** Nobody has felt whether a 5-task chain or a 30-second burst is the fun one. That answer should shape Phase I and could reorder everything before it.
- **Deploy to Vercel.** Build passes, no env vars.

## Verification Commands

```bash
npm run lint
npm test
npm run typecheck
npm run build
npm run e2e
```
