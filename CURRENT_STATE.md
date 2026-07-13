# Current State

Last updated: 2026-07-12

## Summary

Phase 0 (scaffold and tooling) and Phase 1 (domain model and first challenge) of `IMPLEMENTATION_PLAN.md` are complete.

The app builds, typechecks, and runs, but it is not playable yet. The domain model for the grid and the first challenge exists and is tested. There is no grid reducer, no validator, no scoring, no personal records, and no game UI.

## What Exists

### Tooling

- Next.js 16 App Router, React 19, TypeScript 5 (strict), Tailwind CSS v4.
- Vitest + jsdom + Testing Library for domain and component tests.
- Playwright + Chromium for end-to-end tests.
- ESLint 9 flat config.

### Application

- `src/app/layout.tsx`, `src/app/page.tsx`, `src/app/globals.css`: dark app shell with base design tokens. `page.tsx` is a placeholder, not the game surface.

### Domain

- `src/domain/grid/gridTypes.ts`: `CellAddress`, `RangeAddress`, `CellValue`, `CellFormat`, `GridCell`, `GridSelection`, `SortState`, `FilterState`, `GridState`, `GridAction`.
- `src/domain/grid/range.ts`: `cellKey`, `normalizeRange`, `rangesEqual`, `isAddressInRange`, `rangeCellCount`, `columnLabel`.
- `src/domain/grid/selectors.ts`: `getCell`, `columnRangeWithinUsedRange`, `rowRangeWithinUsedRange`.
- `src/domain/challenges/challengeTypes.ts`: `Challenge`, `ValidationSpec`, `TimingPolicy`, `ChallengeScoringConfig`, `PracticeNote`.

### Data

- `src/data/challenges/selectionRevenueColumn.ts`: `createRevenueGrid()` plus the `selectionRevenueColumnChallenge` object.
- `src/data/challenges/index.ts`: `challenges` registry and `defaultChallenge`.
- `src/test/fixtures/revenueGrid.ts`: re-exports `createRevenueGrid` for tests.

The Revenue grid is 12 rows by 8 columns. Row 0 holds bold headers `Region | Rep | Revenue | Units | Status` in columns 0-4. Rows 1-6 hold six data rows. Revenue is column 2 and is formatted as currency. The used range is `{ start: { row: 0, col: 0 }, end: { row: 6, col: 4 } }`, so the required Revenue range is `{ start: { row: 0, col: 2 }, end: { row: 6, col: 2 } }`. The header cell is included, which matches an Excel column-header click.

## What Works

- `npm run dev` serves the dark shell at `/`.
- `npm run lint` is clean.
- `npm run build` succeeds.
- `npm run typecheck` is clean.
- `npm test` passes: 31 tests across 3 files.
- `npm run e2e` passes: 1 Chromium smoke test asserting the shell renders.

Every gate is green. There are no known issues.

## What Does Not Exist Yet

- No grid reducer (Phase 2).
- No selection validator (Phase 2).
- No run state or timer (Phase 2 and Phase 4).
- No scoring (Phase 3).
- No local personal records and no `localStorage` wrapper (Phase 3).
- No game UI, grid component, result card, or retry (Phase 4).
- No `e2e/main-speed.spec.ts` (Phase 5).
- No deployment.

## Known Issues

None blocking.

Two things worth knowing:

- The Git repository root is now `/Users/noahmartz/Desktop/egcell`. Nothing is committed yet: `git ls-files` returns zero tracked files.
- `npm install` left install scripts unapproved for `sharp` and `unrs-resolver` under npm 11's `allowScripts` policy. Neither blocks lint, test, typecheck, build, or e2e. Run `npm approve-scripts` if `sharp`-backed image optimization is needed later.

## Next Best Step

Start Phase 2 in `IMPLEMENTATION_PLAN.md`: the grid reducer and the selection validator.

Phase 2 should land:

- `src/domain/grid/gridReducer.ts`
- `src/domain/validation/validatorTypes.ts`
- `src/domain/validation/validateSelection.ts`
- `src/domain/runs/runTypes.ts`
- Unit tests for the reducer and the validator.

The validator should read the challenge's `ValidationSpec`, never the challenge id. `columnRangeWithinUsedRange` already returns the range a `usedRangeOnly` column selection covers, which is what `requireEntireColumnWithinUsedRange` needs to compare against `requiredRange`.

## Verification Commands

```bash
npm run lint
npm test
npm run typecheck
npm run build
npm run e2e
```
