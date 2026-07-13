# Backlog

## Done

Every phase of `IMPLEMENTATION_PLAN.md`, 0 through 8.

- Scaffold, tooling, and the dark shell.
- Grid domain model, range helpers, selectors.
- Pure grid reducer: selection, formatting, sorting, filtering.
- Spec-keyed validators for all four families.
- Scoring and local personal records.
- The playable game: grid, drag-to-select, toolbar, prompt, timer, result card, retry.
- Eight challenges and a challenge picker.
- Practice mode with post-run route notes.
- Versioned run result and event digest for a future leaderboard.
- 189 unit tests, 17 Chromium e2e tests.

## Immediate

- **Play it.** Nobody has judged whether chasing the time actually feels good. That answer should shape everything below.
- **Keyboard interaction.** The grid is pointer-only, and this is the largest gap in the product. Arrow keys, Ctrl+arrow to jump to the edge of a data region, Shift+arrow to extend, Ctrl+Space for a column, Ctrl+B for bold. Several practice notes already promise routes the player cannot take. No validator needs to change: they all grade end state, not route.
- **Deploy to Vercel.** The build passes and there are no environment variables. Steps are in `IMPLEMENTATION_PLAN.md`.

## Soon

- A second dataset. Every challenge shares one Revenue grid, so it can be memorised. `createRevenueGrid` already takes options; a seeded generator is the natural next step.
- More challenges per family, once a second dataset exists.
- Fixed-time mode. `TimingPolicy` allows it and scoring already carries `completionPercent` for it.
- Show the personal best on the grid surface during a run, so the player is chasing something visible.

## Later

- Simple formula challenges. `CellValue` has a `formula` variant and the formatter renders it, but nothing creates one and there is no parser.
- Official daily challenge shape.
- Profile and account planning.
- Real leaderboard backend, with server-side revalidation of the deterministic validators.
- Replay viewer, built on the run result's event list.
- Measured anti-cheat. Not before there is something to cheat at.
- Themes, once the design tokens have settled.
- Sound.

## Explicitly Not Early

- AI coach.
- Monetization.
- Mobile app.
- Excel import/export.
- Google Sheets integration.
- Microsoft Excel integration.
- Classroom mode.
- Enterprise/team mode.
- Heavy onboarding.
- Forced signup.
- Full global leaderboard before the core loop is proven fun.
- Full anti-cheat before the core loop is proven fun.
- Complex achievements.
- Theme marketplace.
