# Decisions

## 2026-07-12: The Clock Starts When The Grid Appears, Not On The First Click

Decision: A run's timer starts the moment the challenge is on screen, not when the player first interacts.

Reasoning:

- Monkeytype starts its clock on the first keystroke, and copying that here looks tempting.
- It would break scoring. In this game the action *is* the answer: the correct first click both starts and ends the run. Elapsed time would always be near zero, the speed multiplier would sit at its 2.0 cap on every run, and every correct run would score the same.
- The player's reading and aiming time is the skill being measured, so it belongs inside the clock.

Consequences:

- `useGameRun` starts the clock on the first client render rather than on the first action.
- Scores spread across a real range, and a faster run genuinely beats a slower one.
- A player who leaves the tab idle and comes back will post a slow time. Acceptable for now; a pause or an idle reset can come later if it turns out to matter.

## 2026-07-12: Client-Only State Is Read Through useSyncExternalStore

Decision: The personal record store and the run clock are exposed as external stores with a server snapshot, rather than loaded in a mount effect.

Reasoning:

- `localStorage` and `Date.now()` do not exist, or do not agree, during a server render. Reading them while rendering produces a hydration mismatch.
- The obvious fix is to load them in a `useEffect` and call `setState`. That works, but it costs an extra render and React Compiler's `react-hooks/set-state-in-effect` rule rejects it.
- `useSyncExternalStore` is built for exactly this: `getServerSnapshot` returns the empty store and a null clock, the browser reads the real values after hydration, and React reconciles.

Consequences:

- The server renders "no record yet" and a stopped clock. Both fill in immediately in the browser.
- The lint rule stays on, with no suppressions anywhere in the codebase.

## 2026-07-12: Playwright Targets localhost, Not 127.0.0.1

Decision: `playwright.config.ts` uses `http://localhost:3000`.

Reasoning:

- Next's dev server serves from `localhost` and treats a request originating at `127.0.0.1` as cross-origin, so it blocks its own client chunks.
- The page still renders, so this fails in a way that looks like an app bug rather than a config one: a frozen clock and buttons that do nothing, because the page never hydrates.
- The alternative, adding `allowedDevOrigins: ['127.0.0.1']` to `next.config.ts`, loosens the app's origin policy to satisfy a test. Pointing the test at the right origin is the smaller change.

Consequences:

- E2E exercises the same origin a developer uses.
- `next.config.ts` stays empty.

## 2026-07-12: Vitest Installs Its Own localStorage

Decision: `vitest.setup.ts` installs a minimal `localStorage` when the environment lacks one.

Reasoning:

- Node 26 ships an experimental `localStorage` global that stays inert unless the process is started with `--localstorage-file`. It shadows the implementation jsdom would otherwise install, so `window.localStorage` is undefined under Vitest.
- The app already survives that, because `createLocalJsonStorage` guards every call. But then the personal record tests would pass while proving nothing, since no value is ever stored.

Consequences:

- Record persistence is genuinely exercised in unit tests.
- Browsers never take this path. The shim is confined to the test setup file.

## 2026-07-12: One Validator Dispatcher, Keyed By Validation Spec

Decision: `validateChallenge` routes to a validator using `challenge.validation.kind`. Validators never see a challenge id.

Reasoning:

- `ARCHITECTURE.md` calls for a single dispatcher, but no file in the plan's Phase 2 list held one, so `src/domain/validation/validateChallenge.ts` was added.
- Branching on a challenge id would mean every new challenge needs a code change, and renaming or reversioning a challenge would silently break its validation.

Consequences:

- Phase 6 adds a challenge family by registering one validator against a new `ValidationSpec` kind.
- A challenge can be renamed or reversioned without touching validation code, which a test pins.

## 2026-07-12: Scaffold Next.js By Hand Instead Of Using create-next-app

Decision: Write `package.json`, `tsconfig.json`, `next.config.ts`, `postcss.config.mjs`, `eslint.config.mjs`, `vitest.config.ts`, and `playwright.config.ts` by hand rather than running `npm create next-app@latest .` as `IMPLEMENTATION_PLAN.md` suggested.

Reasoning:

- `create-next-app` refuses to scaffold into a directory containing files it does not recognize, and this directory already held ten planning docs.
- The plan already flagged the risk: "Scaffolding in a non-empty directory can overwrite docs if done carelessly."
- Hand-writing the config gives exactly the dependency set the plan calls for and zero chance of touching the docs.

Consequences:

- The scaffold carries no unused boilerplate: no demo page, no SVG assets, no default favicon.
- Config files must be maintained deliberately rather than inherited from a template.

## 2026-07-12: The Challenge Owns Its Grid Data; The Test Fixture Re-Exports It

Decision: `createRevenueGrid()` lives in `src/data/challenges/selectionRevenueColumn.ts`. `src/test/fixtures/revenueGrid.ts` re-exports it.

`ARCHITECTURE.md` and `IMPLEMENTATION_PLAN.md` placed the grid builder in `src/test/fixtures/revenueGrid.ts` while also giving the challenge an `initialGrid` built from it.

Reasoning:

- That arrangement makes production code import from the test tree, which pulls test files into the Next.js bundle and inverts the dependency direction.
- A challenge's dataset is part of the challenge, not a test artifact.

Consequences:

- Production code never imports from `src/test`.
- Tests still get the grid from the fixture path the plan named, so the plan's file list stays accurate.

## 2026-07-12: Challenge Identity Splits Into `id` And `version`

Decision: The first challenge is `id: "selection.revenue-column"` with `version: "v1"`.

`ARCHITECTURE.md` showed `id: "selection.revenue-column.v1"` with no version field. `IMPLEMENTATION_PLAN.md` later gave `Challenge` both an `id` and a `version`. The plan's type wins.

Reasoning:

- The planned leaderboard submission carries `challengeId` and `challengeVersion` as separate fields.
- Versioned validators need to compare a challenge's identity separately from its revision.

Consequences:

- A revalidating server can group runs by `id` and reject a stale `version`.
- The plan's `Challenge` type is used unchanged.

## 2026-07-12: Test And Lint Tooling Corrections

Decision: Depend on `@playwright/test` rather than `playwright`, and set `"lint": "eslint"` rather than `"lint": "next lint"`.

Reasoning:

- `@playwright/test` is the package that provides the `playwright test` runner the plan's `npm run e2e` script calls.
- `next lint` was removed in Next.js 16.

Consequences:

- `npm run e2e` and `npm run lint` behave as the plan intended on the current toolchain.
- A `typecheck` script (`tsc --noEmit`) was added alongside them, because the Next build does not typecheck test files.

## 2026-07-13: Build A Custom Simplified Grid First

Decision: Start with a custom simplified grid rather than embedding Microsoft Excel, integrating Google Sheets, or adopting a full spreadsheet SDK immediately.

Reasoning:

- The first playable build needs selection, validation, timing, retry, and local PRs more than full spreadsheet compatibility.
- A custom grid gives direct control over input latency, event handling, and visual polish.
- The architecture still defines a grid adapter so a richer grid engine can replace or augment the custom grid later.

Consequences:

- Early formula behavior will be limited.
- Early validation can be very deterministic.
- UI must feel spreadsheet-like enough for trust even if it is not a full clone.

## 2026-07-13: Use Local Personal Records Before Accounts

Decision: Store early personal records in `localStorage`.

Reasoning:

- Users must be able to play without signup.
- PR chasing is central to the emotional loop.
- Cloud accounts and leaderboards should wait until the core game is fun.

Consequences:

- PRs are device-local in early builds.
- Clearing browser storage removes records.
- The record model must be easy to migrate later.

## 2026-07-13: Delay Global Leaderboards And Anti-Cheat

Decision: Prepare leaderboard-compatible result shapes, but do not build full global leaderboards or anti-cheat in v1.

Reasoning:

- Leaderboards are only valuable if the core loop feels good.
- Fair validation needs more challenge coverage and replay/event decisions.
- Anti-cheat can become a product sinkhole too early.

Consequences:

- V1 focuses on local PRs.
- Result objects include challenge id, version, seed, score, time, correctness, completion percent, and accuracy.
- Future server validation remains possible.

## 2026-07-13: First Challenge Is "Select The Revenue Column"

Decision: The first playable challenge is selecting the Revenue column.

Reasoning:

- It exercises the spreadsheet grid, selection state, validation, timer, scoring, result card, retry, and PR loop.
- It is fast enough to judge whether the product has the desired "try again" feeling.
- It avoids formula complexity while still being a real spreadsheet action.

Consequences:

- Phase 1 and Phase 2 should optimize for selection fidelity.
- Other challenge families wait until this loop is verified.

