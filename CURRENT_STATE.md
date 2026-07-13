# Current State

Last updated: 2026-07-13

## Summary

**The plan's eight phases plus a full gameplay-expansion batch are complete.** The game now has six play modes, 23 challenges, full keyboard control, a local profile, and player-chosen themes.

Open `/` and a run is already under way. Complete the challenge and it scores, banks a personal record, logs to the local history, and offers a retry or the next challenge.

## Play Modes

| Mode | What it is | Records |
| --- | --- | --- |
| Speed | One challenge, chase the time | Per challenge |
| Practice | Same, with route notes after the run | Per challenge, separate book |
| Sprint 5 / Sprint 10 | Fixed task queue under one clock, skip allowed | Per sprint length |
| 30s / 60s | Tasks keep coming until the countdown dies | Per duration |

Session queues are deterministic slices of the challenge list, so a sprint PR always compares like with like. Tasks inside a session never bank per-challenge records; the session banks one record of its own.

## Challenges

23, in `src/data/challenges/index.ts`: 5 navigation, 6 selection, 5 formatting, 5 sort/filter, 2 mixed. Mixed challenges use a `composite` validation spec, a flat list of leaf specs that must all pass. All run on the one Revenue grid; challenges that grade formatting start from a variant with that formatting stripped, and a registry test proves no challenge starts already complete.

The first eight challenges stay first in the list **in their exact order**, because session queues are slices of it. Reordering them changes what Sprint 5 means.

## Keyboard

The grid is fully playable without a mouse: arrows move, Shift+Arrow extends, Cmd/Ctrl+Arrow jumps to the edge of the data region (riding runs of data, crossing blanks, honouring hidden rows), Cmd/Ctrl+Shift+Arrow extends the jump, Ctrl+Space selects the column, Shift+Space the row, Cmd/Ctrl+A the table, Cmd/Ctrl+B toggles bold, Ctrl+Shift+4/5 apply currency/percent. Formatting shortcuts are gated by the challenge's `allowedActions`, exactly as the toolbar is. Cmd and Ctrl are both accepted; nothing sniffs the platform. The grid takes focus on mount and again on retry.

## Profile and Settings

- `/profile`: recent runs (capped at 50), total runs, total challenges completed, and best score/time per mode. Totals are folded in before the cap trims, so nothing earned is lost.
- `/settings`: 16 theme presets, dark to light to high-contrast to terminal. A preset reassigns all nine design tokens as CSS variables on the document root; a boot script applies a saved theme before first paint. Local-only.

## Architecture Notes

- Domain stays pure and React-free: `domain/grid` (+ `keyboardNav`), `domain/challenges`, `domain/validation` (+ `validateComposite`), `domain/scoring`, `domain/records`, `domain/sessions`, `domain/profile`, `domain/settings`, `domain/runs`.
- Every validator still grades the grid's end state, never the route. The keyboard shipped without touching one.
- Client-only state (records, session records, history, settings, clocks) goes through `useSyncExternalStore`. Zero lint suppressions.
- `useGameRun` gained `recordPersonalBest`, `onFinished`, and `finishNow()` for sessions; the timed deadline is a per-task timeout **plus** a wall-clock check at completion, because setTimeout is a lower bound.

## What Works

All five gates pass:

- `npm run lint` — clean.
- `npm test` — 297 tests across 28 files.
- `npm run typecheck` — clean.
- `npm run build` — succeeds.
- `npm run e2e` — 34 Chromium tests (~38s; one real 30-second timed run).

## What Does Not Exist Yet

- Only one dataset. Every challenge reads the same Revenue table, so it can be memorised.
- No formula family. `CellValue` supports it; nothing creates one.
- Fixed-time partial credit is the validator's `completionPercent` at the buzzer. Finer-grained subgoals would need validators to report per-step progress, which none do.
- No deployment, no accounts, no server, no real leaderboard. By design.

## Known Issues

None blocking.

- `npm install` leaves install scripts unapproved for `sharp` and `unrs-resolver` under npm 11. No gate cares.
- Next warns it inferred the workspace root as `/Users/noahmartz` (stray lockfile there). Warning only; do not set `turbopack.root`, it broke the React Client Manifest once already.
- `<html>` carries `suppressHydrationWarning` because the theme boot script styles it before hydration. That is the one element it is suppressed on.

## Next Best Step

1. **Playtest the sessions.** Sprint and timed modes exist as designed, but nobody has felt whether a 5-task chain or a 30-second burst is the fun one.
2. **Deploy to Vercel.** Build passes, no env vars.
3. **A second dataset**, then a seeded generator, so the table cannot be memorised.

## Verification Commands

```bash
npm run lint
npm test
npm run typecheck
npm run build
npm run e2e
```
