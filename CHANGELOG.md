# Changelog

## 2026-07-13 (challenge variant system, Phase H)

- Added a deterministic generated mixed template with two-step chains and difficulty-5 three-step variants, composed only from the existing sort and formatting validators.
- Composite validation now reports named per-step subgoals while keeping completion as the mean of leaf-validator results and leaving `scoreRun` unchanged.
- Carried subgoal results through skipped and expired session tasks so timed buzzer grading awards existing partial credit and the result breakdown names completed and unfinished steps.
- Added eligibility protection for misaligned labels and incompatible composite final states, plus domain, component, and timed-mode coverage for independent steps, partial credit, either-order completion, and result rendering.
- All five gates pass: lint, 484 unit tests across 51 files, typecheck, production build, and 42 Chromium end-to-end tests.

## 2026-07-13 (core game feel, Tasks 11-12)

- Connected compact, comfortable, and large grid density to one shared geometry model used by cells, row and column headers, and the selection overlay. Gridline strength and the large-target accessibility floor now apply to live single runs and sessions.
- Snapshot grid presentation before a run or session starts so settings changes cannot move targets mid-run. A hydration gate ensures a saved non-default presentation is loaded before the first clock and grid mount.
- Added final browser design checks for arena dominance, all eight keyboard-reachable settings categories, full-motion versus reduced-motion feedback, retry focus, and same-document theme changes.
- Manually checked Ledger Noir and Paper Grid at 1280×900 and 1366×768: no rail overlap or horizontal overflow at the standard desktop viewport, the grid remains dominant, feedback stays restrained, and Retry remains obvious.
- All five gates pass: lint, 476 unit tests across 50 files, typecheck, production build, and 42 Chromium end-to-end tests.

## 2026-07-13 (core game feel, Tasks 8-10)

- Upgraded single and session results with EPM, PB delta, shortcut efficiency, average and fastest task pace, slowest-task retry guidance, and focused retry copy. Technical digests remain behind disclosures and Retry retains focus.
- Added `/leaderboard` as a local-only competition shell with Daily, Weekly, Friends, Global, Skills, and Ranked tabs, full arrow-key navigation, a personal “Near me” band, and explicit no-service empty states instead of fabricated ranks.
- Added a pure mastery projection across Navigation, Selection, Formatting, Formulas, Sort / Filter, Fill / Paste, Tables, and Mixed Workflows. The profile now shows professional levels, focused practice recommendations, badges, and future cosmetic unlock signals above recent runs.
- All five gates pass: lint, 471 unit tests across 49 files, typecheck, production build, and 39 Chromium end-to-end tests.

## 2026-07-13 (core game feel, Tasks 4-7)

- Added a self-ticking live stats bar for EPM, accuracy, shortcut efficiency, and progress. Keyboard and pointer input origins are preserved in replay events.
- Reframed single and session play into a fixed prompt/stats/grid/toolbar hierarchy. The grid stays dominant, timer/stat widths are stable, and sessions have a fixed-width progress rail.
- Added pointer-transparent feedback for task appearance, success, mistakes, shortcuts, combos, PB pace, and run completion. Practice feedback uses 160ms motion or no animation under reduced motion.
- Added eight original synthesized sound categories with master volume and individual local toggles. Sound remains off by default; no copied or bundled audio assets exist.
- All five gates pass: lint, 462 unit tests across 47 files, typecheck, production build, and 39 Chromium end-to-end tests.

## 2026-07-13 (challenge variant system, Phase A)

Architecture and planning only. **No source file changed, no test changed, no behaviour changed.**

- Audited the challenge system and wrote down the eight limits that stop it scaling to many randomised challenges: one dataset, a decorative `seed`, column coordinates as module constants, list-slice session queues, a record key that would explode under generation, coarse partial credit, prompts welded to one table, and three families the grid cannot express. In `CURRENT_STATE.md`.
- Designed the variant system in `ARCHITECTURE.md`: family → template → variant → validator → queue, a seeded RNG with named forked streams, dataset themes, difficulty presets, an eligibility gate, and repetition avoidance. The load-bearing idea is that a generated variant **is** a `Challenge`, so the existing run loop, validators, scoring, and record store consume it unchanged.
- Planned Phases B-I in `IMPLEMENTATION_PLAN.md`, each with files, work, acceptance criteria, tests, risks, and what not to build. The game stays playable at every commit, and no existing personal record is invalidated.
- Recorded five decisions in `DECISIONS.md`. One supersedes "session queues are deterministic slices": its fairness argument is satisfied instead by the fact that `scoreRun` already normalises each task's speed against that task's own target, so a seeded, varied queue pays out comparably to a frozen one.

## 2026-07-13 (gameplay expansion batch)

Eight commits on top of the finished plan, one per section:

- **Keyboard grid controls.** Arrows, Shift-extend, Cmd/Ctrl jumps to the data edge honouring hidden rows, Ctrl+Space / Shift+Space / Cmd+A selections, Cmd/Ctrl+B bold toggle, Ctrl+Shift+4/5 number formats, challenge-gated like the toolbar. Grid autofocuses on mount and retry. Practice notes updated to describe routes that actually work here.
- **Task-count sprint mode.** Sprint 5 and Sprint 10 run a deterministic queue under one session clock, auto-advance, allow skips with partial credit, and bank their own records per length.
- **Fixed-time mode.** 30s and 60s countdowns; the queue stops only when the clock does; the interrupted task is graded as it stands. Records per duration.
- **Result screen.** New PR badge on every record run; correctness and accuracy join the two-second read; session cards carry a per-task breakdown behind a disclosure.
- **Challenge variety.** 8 grew to 23 across all families plus two mixed challenges on a new flat `composite` spec, with a threshold-filter toolbar button to match. The original eight keep their exact head position, because session queues slice the list.
- **Run history and profile.** `/profile` shows recent runs, totals, and per-mode bests; totals survive the 50-row cap. Local only.
- **Polish.** Six defects fixed, three found by a review pass: the timed-deadline race (a completion after the wall-clock deadline but before the pending timer advanced the queue), stale keyboard anchor after retry, per-keystroke full-grid re-renders, two lying PR lines, and a latent countdown re-arm.
- **Settings.** 16 theme presets reassigning all nine design tokens as CSS variables, applied pre-paint by a boot script, chosen per device at `/settings`.

297 unit tests across 28 files, 34 e2e. All five gates pass.

## 2026-07-12 (phases 6 to 8)

**All eight phases of the plan are complete.**

- Expanded to eight challenges across four families: navigation, selection, formatting, and sort/filter. `ValidationSpec` became a real discriminated union, and the validator dispatcher switches over it exhaustively, so adding a family without a validator is now a type error.
- Taught the grid to format, sort, and filter. Sorting moves the whole row with the sorted value and leaves the header alone. Filtering removes rows from the page, and a later sort recomputes which rows are hidden, because sorting changes which row holds which value.
- Added drag-to-select. Without it a player could not select an arbitrary range at all, which made the whole-table challenge unplayable.
- Added a toolbar that only offers the actions the current challenge allows, so a selection challenge shows no toolbar at all.
- Added a challenge picker and a "Next challenge" step through the set.
- Added practice mode. Same validators, same scoring; the one difference is that the result card shows the route notes once the run is over. There is no code path that can show a hint during play.
- Added a versioned, serializable run result and a client event digest for a future leaderboard. Nothing is submitted anywhere, and a test spies on `fetch` to prove it. The digest is explicitly not a security primitive.
- A registry test asserts no challenge starts already complete, which is the easiest way to ship an unplayable one.

189 unit tests, 17 e2e tests. Lint, test, typecheck, build, and e2e all pass.

## 2026-07-12 (later)

Phases 2 through 5 of `IMPLEMENTATION_PLAN.md`. **The game is playable.**

- Added the grid reducer. It is pure, and returns the same object for an action that lands outside the grid, so a stray click cannot clear a selection the player already made.
- Added selection validation. `validateChallenge` dispatches on the challenge's `ValidationSpec`, never on its id. Clicking a column header and dragging that column's data validate identically.
- Added run scoring. Correctness is squared, so a half-right run pays a quarter rather than a half. Speed is clamped to a factor between 0.2 and 2.
- Added local personal records, with an SSR-safe storage wrapper that drops corrupt or unrecognised entries rather than crashing.
- Built the game surface: dark shell, spreadsheet grid with a selection overlay, prompt, self-animating timer, result card with a details disclosure, and retry.
- The clock starts when the grid appears, not on the first click. Starting it on the first action would pin every correct run at the speed cap and flatten the score.
- Client-only state (records, clock) is read through `useSyncExternalStore` with a server snapshot, so hydration is clean and no lint rule is suppressed.
- Replaced the Phase 0 smoke test with `e2e/main-speed.spec.ts`: 7 Chromium tests covering the whole loop, including a personal record surviving a page reload.
- Fixed the Playwright base URL. It pointed at `127.0.0.1`, which Next's dev server treats as cross-origin, so the page rendered but never hydrated.

105 unit tests, 7 e2e tests. Lint, test, typecheck, build, and e2e all pass.

## 2026-07-12

Phase 0 and Phase 1 of `IMPLEMENTATION_PLAN.md`.

- Scaffolded the app: Next.js 16 App Router, React 19, TypeScript strict, Tailwind CSS v4, ESLint 9, Vitest + jsdom + Testing Library, Playwright + Chromium.
- Added the dark app shell and base design tokens. The route at `/` is still a placeholder, not the game.
- Added the grid domain model: addresses, ranges, cells, selection, sort/filter state, and grid actions.
- Added range helpers (`normalizeRange`, `rangesEqual`, `isAddressInRange`, `rangeCellCount`, `cellKey`, `columnLabel`) and grid selectors (`getCell`, `columnRangeWithinUsedRange`, `rowRangeWithinUsedRange`).
- Added the `Challenge` type and the first challenge, "Select the Revenue column", with its Revenue dataset, validation spec, and scoring config.
- 31 unit tests cover the range helpers, the selectors, and the challenge definition.
- Fixed `eslint.config.mjs`. It had wrapped `eslint-config-next` in the `FlatCompat` eslintrc shim, which threw `TypeError: Converting circular structure to JSON` before linting anything. Next 16 ships flat config arrays, so `eslint-config-next/core-web-vitals` and `eslint-config-next/typescript` are now imported directly. Dropped the `@eslint/eslintrc` dependency, which the shim was the only user of.
- Lint, test, typecheck, build, and e2e all pass.

## 2026-07-13

- Added the initial product strategy, architecture, implementation plan, current-state, decisions, backlog, and handoff docs.
- Defined the first playable target around the "Select the Revenue column" challenge.
- Chose a custom simplified grid first with a future grid adapter boundary.
- Chose local personal records before accounts or leaderboards.
