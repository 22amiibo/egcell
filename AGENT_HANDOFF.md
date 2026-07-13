# Agent Handoff

Last updated: 2026-07-12

## What Was Done

Phase 0 (scaffold and tooling) and Phase 1 (domain model and first challenge) of `IMPLEMENTATION_PLAN.md`.

The app builds and runs. It is not playable yet. The route at `/` shows a dark placeholder shell, not the game.

Created:

- Scaffold: `package.json`, `tsconfig.json`, `next.config.ts`, `postcss.config.mjs`, `eslint.config.mjs`, `vitest.config.ts`, `vitest.setup.ts`, `playwright.config.ts`, `.gitignore`.
- App shell: `src/app/layout.tsx`, `src/app/page.tsx`, `src/app/globals.css`.
- Domain: `src/domain/grid/gridTypes.ts`, `src/domain/grid/range.ts`, `src/domain/grid/selectors.ts`, `src/domain/challenges/challengeTypes.ts`.
- Data: `src/data/challenges/selectionRevenueColumn.ts`, `src/data/challenges/index.ts`.
- Tests: `src/domain/grid/range.test.ts`, `src/domain/grid/selectors.test.ts`, `src/data/challenges/selectionRevenueColumn.test.ts`, `src/test/fixtures/revenueGrid.ts`, `e2e/smoke.spec.ts`.

Four decisions were recorded in `DECISIONS.md`: the hand-written scaffold, the challenge owning its grid data, `id` split from `version`, and the `@playwright/test` and `eslint` tooling corrections.

`eslint.config.mjs` was then corrected to Next 16's flat-config style, importing `eslint-config-next/core-web-vitals` and `eslint-config-next/typescript` directly instead of routing them through the `FlatCompat` eslintrc shim. `@eslint/eslintrc` was uninstalled with it.

## Required Reading Before Coding

1. `PRODUCT_STRATEGY.md`
2. `ARCHITECTURE.md`
3. `IMPLEMENTATION_PLAN.md`
4. `CURRENT_STATE.md`
5. `DECISIONS.md`

## Next Step

Phase 2 in `IMPLEMENTATION_PLAN.md`: the grid reducer and the selection validator.

Land these:

- `src/domain/grid/gridReducer.ts`
- `src/domain/validation/validatorTypes.ts`
- `src/domain/validation/validateSelection.ts`
- `src/domain/runs/runTypes.ts`
- `src/domain/grid/gridReducer.test.ts`
- `src/domain/validation/validateSelection.test.ts`

Two things to hold on to:

- The validator must dispatch on `challenge.validation.kind` and read the `ValidationSpec`. It must never branch on a challenge id.
- `columnRangeWithinUsedRange(grid, col)` in `src/domain/grid/selectors.ts` already returns the range a `usedRangeOnly` column selection covers. That is what `requireEntireColumnWithinUsedRange` compares against `requiredRange`. Selecting column 2, and selecting the exact range `{ start: { row: 0, col: 2 }, end: { row: 6, col: 2 } }`, must both validate complete.

Do not start Phase 4 (the UI) until the reducer, the validator, and Phase 3's scoring have passing tests.

## Known Issues

None blocking. Three things worth knowing:

- The Git repository root is `/Users/noahmartz/Desktop/egcell`. Nothing is committed yet: `git ls-files` returns zero tracked files.
- `npm install` left install scripts unapproved for `sharp` and `unrs-resolver` under npm 11's `allowScripts` policy. Neither blocks any gate. Run `npm approve-scripts` if `sharp`-backed image optimization is needed later.
- `e2e/smoke.spec.ts` asserts only that the shell renders. Phase 5 replaces it with `e2e/main-speed.spec.ts` covering the real loop.

## Verification Commands

```bash
npm run lint
npm test
npm run typecheck
npm run build
npm run e2e
```

All five pass as of this handoff: clean lint, 31 unit tests, a clean typecheck, a successful build, and 1 Chromium e2e test.
