# Agent Handoff

Last updated: 2026-07-12

## What Was Done

Phases 0 through 5 of `IMPLEMENTATION_PLAN.md`. **The game is playable.**

Open `/`, and a run is already under way against "Select the Revenue column". Click the Revenue column header and the run completes, scores, banks a personal record, and offers a retry. The record survives a reload.

Committed on `main`, one commit per phase:

- `1de4388` Phase 0 and Phase 1: scaffold, grid domain model, first challenge.
- `f3e387e` Phase 2: grid reducer, selection validation.
- `807245c` Phase 3: scoring, local personal records.
- `b88d1b6` Phase 4: the playable game surface.
- Phase 5: the main-speed e2e suite and the doc updates.

## Required Reading Before Coding

1. `PRODUCT_STRATEGY.md`
2. `ARCHITECTURE.md`
3. `IMPLEMENTATION_PLAN.md`
4. `CURRENT_STATE.md`
5. `DECISIONS.md`

## Next Step

Phase 6 in `IMPLEMENTATION_PLAN.md`: expand the challenge families.

To add a family:

1. Turn `ValidationSpec` in `domain/challenges/challengeTypes.ts` into a real discriminated union. It is a one-member union today, so it has never had to discriminate.
2. Write the validator in `domain/validation/` and register it in the `validators` map in `validateChallenge.ts`.
3. Add `GridAction` kinds and `gridReducer` cases if the family needs interactions the grid cannot yet perform. Formatting and sort/filter both do; navigation does not.
4. Add the challenge with a deterministic fixture in `data/challenges/`, and export it from `data/challenges/index.ts`.
5. Unit test the validator's pass and fail states.

Navigation is the cheapest family to start with: no new grid actions, just a validator comparing `grid.activeCell` to a target.

## Things That Will Bite You

- **The clock starts when the grid appears, not on the first click.** This is deliberate, and `DECISIONS.md` explains why: in this game the action is the answer, so starting the clock on the first action would put every correct run at roughly zero elapsed time and pin the speed multiplier at its cap. Do not "fix" this.
- **Playwright must target `localhost`, not `127.0.0.1`.** Next's dev server treats `127.0.0.1` as cross-origin and blocks its own client chunks. The page still renders, so the symptom looks like an app bug: a frozen clock and dead buttons, because nothing hydrates.
- **Playwright's accessible-name matching is substring by default.** `getByRole("button", { name: "C1" })` also matches C10, C11, and C12. Use `exact: true` for cell locators.
- **Do not clear `localStorage` with `page.addInitScript`.** It re-runs on every navigation, so it wipes the record mid-test in anything that reloads. Each Playwright test already gets a fresh context with empty storage.
- **`window.localStorage` is undefined under Vitest** on Node 26, which ships an experimental `localStorage` global that shadows jsdom's. `vitest.setup.ts` installs a shim. Browsers never take that path.
- **Client-only state goes through `useSyncExternalStore`,** not a mount effect. React Compiler's `react-hooks/set-state-in-effect` rule is on, and there are no suppressions in the codebase. Keep it that way.
- **`challenge.initialGrid` is a single shared object.** The reducer is pure and never mutates it, which is what makes retry safe. If you ever add a mutating path, this breaks quietly.

## Known Issues

None blocking.

- The Git root is `/Users/noahmartz/Desktop/egcell`. There is no remote, so nothing has been pushed.
- `npm install` left install scripts unapproved for `sharp` and `unrs-resolver` under npm 11's `allowScripts` policy. Neither blocks any gate.
- Next warns that it inferred the workspace root as `/Users/noahmartz`, because of a stray `package-lock.json` there. It is only a warning. Setting `turbopack.root` to silence it broke Next's React Client Manifest and was reverted. Either leave it, or delete the stray lockfile in the home directory.

## Gaps Worth Knowing About

- The grid is pointer-only. There is no keyboard interaction, so the "fast route" the challenge's practice note describes cannot actually be taken yet.
- Range selections are only reachable programmatically. There is no drag-to-select.
- `practiceNotes` exist on the challenge but nothing renders them. That is Phase 7.

## Verification Commands

```bash
npm run lint
npm test
npm run typecheck
npm run build
npm run e2e
```

All five pass as of this handoff: clean lint, 105 unit tests across 9 files, clean typecheck, a successful build, and 7 Chromium e2e tests.
