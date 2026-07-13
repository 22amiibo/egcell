# Decisions

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

