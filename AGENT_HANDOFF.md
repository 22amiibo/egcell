# Agent Handoff

Last updated: 2026-07-12

## What Was Done

**Every phase of `IMPLEMENTATION_PLAN.md`, 0 through 8.** The game is playable, in two modes, across four challenge families.

Open `/` and a run is already under way. The clock is going. Complete the challenge and it scores, banks a personal record, and offers a retry or the next challenge.

Nine commits on `main`, one per phase:

| Commit | Phase |
| --- | --- |
| `1de4388` | 0 and 1: scaffold, grid domain model, first challenge |
| `f3e387e` | 2: grid reducer, selection validation |
| `807245c` | 3: scoring, local personal records |
| `b88d1b6` | 4: the playable game surface |
| `7d1a5b2` | 5: main-speed e2e suite, docs |
| `67c3190` | 6: four challenge families, drag-to-select, toolbar |
| `323d8d2` | 7: practice mode |
| `ca08d35` | 8: run result and event digest |

No remote, so nothing has been pushed.

## Required Reading Before Coding

1. `PRODUCT_STRATEGY.md`
2. `ARCHITECTURE.md`
3. `CURRENT_STATE.md`
4. `DECISIONS.md`

`IMPLEMENTATION_PLAN.md` is now a record of what was built rather than a plan of what to build. Every phase is marked complete.

## Next Step

The plan is finished, so this is a judgement call. In order of value:

1. **Play it and decide whether it is fun.** The loop works and every gate is green, but nobody has judged whether chasing the time actually feels good. That answer matters more than anything below.
2. **Keyboard interaction.** This is the largest gap. The grid is pointer-only, and several practice notes already describe Excel keyboard routes a player cannot take here. Arrow keys, Ctrl+arrow to jump to the edge of a data region, Shift+arrow to extend a selection, Ctrl+Space for a column, Ctrl+B for bold. **No validator needs to change**: every one of them grades the grid's end state rather than the route, precisely so this could be added later.
3. **Deploy to Vercel.** The build passes and there are no environment variables.
4. **A second dataset.** All eight challenges share one Revenue grid, so it can be memorised. `createRevenueGrid` already takes options.

## Things That Will Bite You

- **The clock starts when the grid appears, not on the first click.** Deliberate. In this game the action is the answer, so a clock that started on the first action would put every correct run at roughly zero elapsed time and pin the speed multiplier at its cap. Do not "fix" this.
- **No challenge may start already complete.** A challenge whose starting grid satisfies its own validator finishes the instant the player touches anything. It is the easiest way to ship an unplayable challenge, which is why the bold and currency challenges start from a grid with that formatting stripped out. A registry test enforces it.
- **Validators must never branch on a challenge id.** They read the `ValidationSpec`. A test pins this by relabelling a challenge and checking it still validates.
- **Playwright's accessible-name matching is substring by default.** `{ name: "C1" }` also matches C10, C11, C12; `{ name: "Select row 1" }` also matches rows 10 to 12. Use `exact: true`. This has bitten twice.
- **Playwright must target `localhost`, not `127.0.0.1`.** Next's dev server treats `127.0.0.1` as cross-origin and blocks its own client chunks. The page still renders, so it looks like an app bug: a frozen clock and dead buttons, because nothing hydrates.
- **Do not clear `localStorage` with `page.addInitScript`.** It re-runs on every navigation, so it wipes the record mid-test in anything that reloads. Each Playwright test already gets a fresh context.
- **`window.localStorage` is undefined under Vitest** on Node 26, which ships an experimental `localStorage` global that shadows jsdom's. `vitest.setup.ts` installs a shim.
- **Client-only state goes through `useSyncExternalStore`,** never a mount effect. React Compiler's `react-hooks/set-state-in-effect` rule is on and there are zero suppressions in the codebase. Keep it that way.
- **`challenge.initialGrid` is a single shared object.** The reducer is pure and never mutates it, which is what makes retry safe. A mutating path would break this quietly.
- **The click after a drag is suppressed on purpose.** Without that, it would collapse the range the player just dragged back down to one cell.
- **The event digest is not security.** It is client-computed with a published algorithm and no secret. Read its docstring before building anything on it.

## Adding A Challenge Family

1. Add a variant to `ValidationSpec` in `domain/challenges/challengeTypes.ts`.
2. Write the validator in `domain/validation/` and add a case to the switch in `validateChallenge.ts`. The switch is exhaustive, so TypeScript will fail the build until you do.
3. Add `GridAction` kinds and `gridReducer` cases if the family needs interactions the grid cannot yet perform.
4. Add the challenge to `data/challenges/index.ts`, listing the actions it needs in `allowedActions`. The toolbar follows automatically.
5. Unit test the validator's pass and fail states. The registry tests will already be checking that it does not start complete.

## Known Issues

None blocking.

- `npm install` left install scripts unapproved for `sharp` and `unrs-resolver` under npm 11's `allowScripts` policy. Neither blocks any gate.
- Next warns that it inferred the workspace root as `/Users/noahmartz`, because of a stray `package-lock.json` there. It is only a warning. Setting `turbopack.root` to silence it broke Next's React Client Manifest and was reverted. Either leave it, or delete the stray lockfile in the home directory.

## Verification Commands

```bash
npm run lint
npm test
npm run typecheck
npm run build
npm run e2e
```

All five pass as of this handoff: clean lint, 189 unit tests across 15 files, clean typecheck, a successful build, and 17 Chromium e2e tests.
