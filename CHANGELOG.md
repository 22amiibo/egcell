# Changelog

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

