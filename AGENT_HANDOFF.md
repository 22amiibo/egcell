# Agent Handoff

Last updated: 2026-07-13

## What Was Done

The original plan (phases 0-8) plus the 2026-07-13 gameplay expansion batch. Six play modes, 23 challenges, full keyboard control, a local profile, and 16 player-chosen themes.

Seventeen commits on `main`. The batch, one commit per section:

| Commit | Section |
| --- | --- |
| `c72590b` | Keyboard grid controls |
| `887b8f3` | Task-count sprint mode (Sprint 5 / Sprint 10) |
| `454f80d` | Fixed-time mode (30s / 60s) |
| `339cd59` | Result screen and run breakdown |
| `9fa413a` | Challenge variety (8 → 23, composite spec) |
| `b0c5d66` | Local run history and profile stats |
| `2340204` | Polish pass: six defects fixed |
| `31bb450` | Settings with 16 theme presets |

Docs commit follows. No remote, so nothing has been pushed.

## Required Reading Before Coding

1. `PRODUCT_STRATEGY.md`
2. `ARCHITECTURE.md`
3. `CURRENT_STATE.md`
4. `DECISIONS.md`

`IMPLEMENTATION_PLAN.md` is a historical record; the batch above was user-directed post-plan work, summarized in `CHANGELOG.md`.

## Next Step

**Phase B of the Challenge Variant System**, in `IMPLEMENTATION_PLAN.md`: seeded RNG, seed composition, and the template/variant/difficulty types. Read `ARCHITECTURE.md` § Challenge Variant Architecture first — the whole design lives there, and Phase A (2026-07-13) was writing it. No code has changed for it yet.

Off that path, unblocked, still worth doing:

1. **Playtest the sessions.** Nobody has felt whether a 5-task chain or a 30-second burst is the fun one. It should shape Phase I and could reorder everything before it.
2. **Deploy to Vercel.** Build passes, no env vars.

## Adding A Challenge, After Phase A

**Do not hand-write another challenge literal.** The 23 that exist are the last of their kind; the variant system replaces hand-authoring with templates that generate from a seed. If more variety is wanted before Phase E lands, build Phase B — that is the whole point of the plan.

The rules that will govern every generated challenge, and that interim work must not violate:

- **Grid and validation spec come out of one schema, in one call.** A spec may never name a column constant. This is the failure mode that is both silent and fatal; see `DECISIONS.md`.
- **Validators grade final grid state, never route.** Unchanged, and the reason keyboard support cost zero validator edits.
- **A record keys to the drill (template + difficulty); the seed varies.** Key a record by seed and every run is a first-ever PR.
- **Sessions chase score, single runs chase time.** A sprint elapsed-time record cannot survive randomisation and must never be introduced.
- **Difficulty comes from the table, never from a vaguer prompt.**
- **Eligibility is a gate, not a warning.** A variant that fails a check is re-drawn, bounded, and never shipped.

## Things That Will Bite You

Everything from the previous handoff still applies (clock starts when the grid appears; no challenge may start complete; validators never branch on challenge id; Playwright needs `exact: true` and `localhost`; no `page.addInitScript` for storage; Vitest needs the localStorage shim; client-only state goes through `useSyncExternalStore`; `initialGrid` is shared and never mutated; the click after a drag is suppressed; the event digest is not security). New ones from this batch:

- **The first eight challenges are pinned, in order, at the head of `challenges`.** Session queues are deterministic slices of that list. Reordering it silently changes what Sprint 5 means and invalidates every sprint record.
- **The timed deadline needs both halves.** The per-task `setTimeout` AND the wall-clock check in `handleTaskFinished`. Removing either reopens the race where a completion after the deadline advances the queue.
- **`vi.useFakeTimers` must fake only `setTimeout`/`clearTimeout`/`Date`.** The full fake set also fakes what React schedules its own work with, and every interaction deadlocks. `timedMode.test.tsx` documents the working recipe; it uses `fireEvent`, not `userEvent`, for the same reason.
- **Keyboard e2e must wait for grid focus** (`toBeFocused()`) after switching challenges. The grid takes focus in an effect; keystrokes sent before that lands go to the select. This flaked once under parallel workers before the waits went in.
- **Playwright asserts text with `toContainText`,** not jest-dom's `toHaveTextContent`. The latter type-checks against the wrong expect and fails `tsc`.
- **`CellView` takes `row`/`col` primitives on purpose.** Recombining them into an address prop re-renders the whole grid per keystroke; the memo relies on shallow-equal primitives.
- **The settings store is a module singleton on purpose.** The theme applier in the layout and the picker on the settings page must share one store. The per-component store pattern used by records would leave them out of sync.
- **`suppressHydrationWarning` is on `<html>` only,** because the theme boot script styles it pre-hydration. Do not spread it further.
- **Keyboard formatting shortcuts are gated by `allowedActions`.** Movement and selection keys are never gated: they are how the player gets around.
- **`finishNow()` grades whatever is on the grid.** Skips and buzzer grading both ride it. It banks no personal record by design.

## Adding Things

- **A challenge:** add to `data/challenges/index.ts` *after* the pinned first eight. Registry tests enforce uniqueness, a practice note, no-shortcut prompts, and that it does not start complete.
- **A challenge family:** new `LeafValidationSpec` variant, validator, dispatcher case (exhaustive switch fails the build until added), reducer actions if the grid cannot do it yet.
- **A mixed challenge:** compose leaf specs in a `composite`. Never nest composites; the type forbids it.
- **A theme:** append to `THEME_PRESETS`. The test suite checks the token set is complete and well-formed; the boot script and settings page both derive from the same array.
- **A session mode:** extend `SessionMode` and `SESSION_PLANS`; records, queue, and UI key off the plan shape.

## Known Issues

None blocking.

- `npm install` leaves `sharp`/`unrs-resolver` install scripts unapproved under npm 11. No gate cares.
- Next warns about the inferred workspace root (stray lockfile in `/Users/noahmartz`). Do not set `turbopack.root`; it broke the React Client Manifest once already.
- The e2e suite takes ~38s, dominated by one honest real-time 30-second timed run.

## Verification Commands

```bash
npm run lint
npm test
npm run typecheck
npm run build
npm run e2e
```

All five pass as of this handoff: clean lint, 297 unit tests across 28 files, clean typecheck, a successful build, and 34 Chromium e2e tests.
