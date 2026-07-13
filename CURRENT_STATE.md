# Current State

Last updated: 2026-07-12

## Summary

**All eight phases of `IMPLEMENTATION_PLAN.md` are complete.** The game is playable, in two modes, across four challenge families.

Open `/` and a run is already under way. The clock is going. Complete the challenge and it scores, banks a personal record, and offers a retry or the next challenge. Records survive a reload.

## What Exists

### Tooling

Next.js 16 App Router, React 19, TypeScript 5 (strict), Tailwind CSS v4. Vitest + jsdom + Testing Library. Playwright + Chromium. ESLint 9 flat config, including React Compiler's hook rules, with no suppressions anywhere in the codebase.

### Challenges

Eight, in `src/data/challenges/index.ts`, playable in order or picked from the top bar:

| Family | Challenge |
| --- | --- |
| selection | Select the Revenue column |
| navigation | Go to the last Revenue cell |
| selection | Select the header row |
| selection | Select the whole table |
| formatting | Bold the header row |
| formatting | Format Revenue as currency |
| sort-filter | Sort Revenue high to low |
| sort-filter | Show only the East region |

All eight run on the same Revenue grid: 12 rows by 8 columns, one header row, `Region | Rep | Revenue | Units | Status` in columns 0-4, six data rows, used range `{0,0}` to `{6,4}`. The bold and currency challenges start from a variant with that formatting removed, or they would begin already complete.

### Domain (no React, heavily unit tested)

- `domain/grid`: `gridTypes`, `range`, `cellValues`, `selectors`, `gridReducer`. The reducer is pure and handles selection, formatting, sorting, and filtering. It returns the same object for an action that changes nothing.
- `domain/challenges`: `challengeTypes`. `ValidationSpec` is a discriminated union over the four families.
- `domain/validation`: `validateChallenge` (an exhaustive dispatcher), plus `validateSelection`, `validateNavigation`, `validateFormatting`, `validateSortFilter`. Every validator grades the grid's end state, never the route the player took.
- `domain/scoring`: `scoreRun`.
- `domain/records`: personal records, pure, with storage injected.
- `domain/runs`: `runTypes`, `runResult`, `eventDigest`.

### Application

- `hooks/useGameRun`, `hooks/useLocalPersonalRecords`.
- `components/game`: `GameShell`, `ChallengeRun`, `ChallengePrompt`, `TimerDisplay`, `Toolbar`, `ResultCard`, `PracticeNotes`, `RetryButton`, `StatRow`.
- `components/grid`: `SpreadsheetGrid`, `ColumnHeader`, `RowHeader`, `CellView`, `SelectionOverlay`, `gridMetrics`.
- `lib`: `storage`, `format`.

## What Works

All five gates pass:

- `npm run lint` — clean.
- `npm test` — 189 tests across 15 files.
- `npm run typecheck` — clean.
- `npm run build` — succeeds.
- `npm run e2e` — 17 Chromium tests.

Behaviour worth knowing is real, because a test pins it:

- The clock starts when the grid appears, not on the first click.
- A wrong move never ends a run. The player can always recover.
- Sorting moves the whole row with the sorted value, and never touches the header.
- Filtering removes rows from the page, and a later sort recomputes which rows are hidden.
- Drag-to-select works with a real mouse, and the click that follows a drag does not collapse the range.
- The toolbar only offers the actions the current challenge allows. A selection challenge shows no toolbar.
- No hint is reachable during an active run, in either mode.
- A practice record can never be mistaken for a speed record.
- No challenge starts already complete.
- A completed run calls `fetch` zero times.

## What Does Not Exist Yet

- **No keyboard interaction.** The grid is pointer-only. This is the biggest gap: several practice notes describe an Excel keyboard route the player cannot actually take here.
- No formula family. `CellValue` has a `formula` variant and `formatCellValue` renders it, but nothing creates one and there is no parser.
- No fixed-time mode. `TimingPolicy` allows it and scoring carries `completionPercent` for it, but nothing uses it.
- No leaderboard, no accounts, no server. By design.
- No deployment.
- Only one dataset. Every challenge uses the same Revenue grid.

## Known Issues

None blocking.

- The Git root is `/Users/noahmartz/Desktop/egcell`. Nine commits on `main`, one per phase. No remote, so nothing has been pushed.
- `npm install` left install scripts unapproved for `sharp` and `unrs-resolver` under npm 11's `allowScripts` policy. Neither blocks any gate.
- Next warns that it inferred the workspace root as `/Users/noahmartz`, because of a stray `package-lock.json` there. It is only a warning. Setting `turbopack.root` to silence it broke Next's React Client Manifest and was reverted. Either leave it, or delete the stray lockfile in the home directory.

## Next Best Step

The plan is finished, so this is a judgement call rather than a step the plan dictates. In order of value:

1. **Keyboard interaction.** Arrow keys, Ctrl+arrow to jump to the edge of a data region, Shift+arrow to extend a selection, Ctrl+Space for a column, Ctrl+B for bold. This is what the product is ultimately about, the practice notes already promise it, and every validator grades end state rather than route, so no validator has to change.
2. **Deploy to Vercel.** `npm run build` passes and there are no environment variables. See the deployment plan in `IMPLEMENTATION_PLAN.md`.
3. **A second dataset.** Every challenge shares one grid, so a player can memorise it. `createRevenueGrid` already takes options; a seeded generator is the natural next move.
4. **Play it and see if it is fun.** The loop works, but nobody has judged whether chasing the time actually feels good. That answer should drive whatever comes next, more than any item above.

## Verification Commands

```bash
npm run lint
npm test
npm run typecheck
npm run build
npm run e2e
```
