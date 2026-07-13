# Current State

Last updated: 2026-07-12

## Summary

Phases 0 through 5 of `IMPLEMENTATION_PLAN.md` are complete. **The game is playable.**

Opening `/` starts a run against "Select the Revenue column". The clock is already going. Clicking the Revenue column header completes the run, scores it, banks a personal record, and offers a retry. The record survives a reload.

Phases 6, 7, and 8 have not been started.

## What Exists

### Tooling

- Next.js 16 App Router, React 19, TypeScript 5 (strict), Tailwind CSS v4.
- Vitest + jsdom + Testing Library. Playwright + Chromium. ESLint 9 flat config, including React Compiler's hook rules.

### Domain (no React, fully unit tested)

- `domain/grid`: `gridTypes`, `range` (`normalizeRange`, `rangesEqual`, `isAddressInRange`, `rangeCellCount`, `cellKey`, `columnLabel`), `selectors` (`getCell`, `columnRangeWithinUsedRange`, `rowRangeWithinUsedRange`, `selectionBounds`, `isCellSelected`), `gridReducer` (pure; returns the same object for an action that lands outside the grid).
- `domain/challenges`: `challengeTypes`.
- `domain/validation`: `validatorTypes`, `validateSelection` (`selectionToRange`), `validateChallenge` (the dispatcher; routes on `ValidationSpec.kind`, never on a challenge id).
- `domain/scoring`: `scoringTypes`, `scoreRun`.
- `domain/records`: `recordTypes`, `personalRecords` (`recordKey`, `isPersonalRecordEligible`, `betterRecord`, `updatePersonalRecords`, `readPersonalRecords`, `writePersonalRecords`).
- `domain/runs`: `runTypes`.

### Data

- `data/challenges/selectionRevenueColumn.ts`: `createRevenueGrid()` and `selectionRevenueColumnChallenge`.
- `data/challenges/index.ts`: `challenges`, `defaultChallenge`.

### Application

- `hooks/useGameRun`: owns one run. Starts the clock, applies actions, validates after each one, scores on completion, submits the record.
- `hooks/useLocalPersonalRecords`: the record store, read through `useSyncExternalStore`.
- `components/game`: `GameShell`, `ChallengePrompt`, `TimerDisplay`, `ResultCard`, `RetryButton`, `StatRow`.
- `components/grid`: `SpreadsheetGrid`, `ColumnHeader`, `RowHeader`, `CellView`, `SelectionOverlay`, `gridMetrics`.
- `lib`: `storage` (SSR-safe JSON storage), `format` (pinned `en-US` formatters, so server and client agree).

The Revenue grid is 12 rows by 8 columns. Row 0 holds bold headers `Region | Rep | Revenue | Units | Status` in columns 0-4. Rows 1-6 hold six data rows. Revenue is column 2, formatted as currency. The used range is `{ start: { row: 0, col: 0 }, end: { row: 6, col: 4 } }`, so the required Revenue range is `{ start: { row: 0, col: 2 }, end: { row: 6, col: 2 } }`. The header cell is included, matching an Excel column-header click.

## What Works

All five gates pass:

- `npm run lint` — clean.
- `npm test` — 105 tests across 9 files.
- `npm run typecheck` — clean.
- `npm run build` — succeeds.
- `npm run e2e` — 7 Chromium tests covering the whole loop: open, clock already running, wrong column does not end the run, recover and finish, result card, details disclosure, retry restarts, personal record survives a reload.

## What Does Not Exist Yet

- Only one challenge. No navigation, formatting, or sort/filter families (Phase 6).
- No keyboard interaction. The grid is pointer-only.
- No drag-to-select. A range can only be selected programmatically, not by the player.
- No practice mode, and no mode toggle. `practiceNotes` exist on the challenge but are never shown (Phase 7).
- No serializable run result and no event digest (Phase 8).
- No deployment.

## Known Issues

None blocking.

Worth knowing:

- The Git root is `/Users/noahmartz/Desktop/egcell`. Work through Phase 5 is committed on `main`. There is no remote, so nothing has been pushed.
- `npm install` left install scripts unapproved for `sharp` and `unrs-resolver` under npm 11's `allowScripts` policy. Neither blocks any gate. Run `npm approve-scripts` if `sharp`-backed image optimization is ever needed.
- Next warns that it inferred the workspace root as `/Users/noahmartz`, because a stray `package-lock.json` sits there. It is only a warning. Setting `turbopack.root` to silence it broke Next's React Client Manifest, so it was reverted. Leave it alone, or delete the stray lockfile in the home directory.

## Next Best Step

Phase 6 in `IMPLEMENTATION_PLAN.md`: expand the challenge families.

Adding a family means:

1. A new `ValidationSpec` variant in `domain/challenges/challengeTypes.ts` (it is currently a one-member union, so it needs to become a real discriminated union).
2. A validator in `domain/validation/`, registered in the `validators` map in `validateChallenge.ts`.
3. New `GridAction` kinds and reducer cases if the family needs interactions the grid cannot yet perform. Formatting and sort/filter both do.
4. A challenge with a deterministic fixture in `data/challenges/`.
5. Unit tests for the validator's pass and fail states.

Navigation is the cheapest family to add: it needs no new grid actions, only a validator that compares `grid.activeCell` against a target.

## Verification Commands

```bash
npm run lint
npm test
npm run typecheck
npm run build
npm run e2e
```
