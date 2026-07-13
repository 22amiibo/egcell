# Backlog

## Done

- Scaffold Next.js app without deleting docs.
- Add Vitest, Testing Library, and Playwright.
- Create grid and challenge domain types.
- Add the first challenge: "Select the Revenue column."
- Fix `eslint.config.mjs` so `npm run lint` runs clean.
- Grid reducer and selection validation.
- Scoring and local personal records.
- First playable UI: grid, prompt, timer, result card, retry.
- Playwright coverage of the full main-speed loop.

## Immediate

- Phase 6: turn `ValidationSpec` into a real discriminated union, then add the navigation family (cheapest: no new grid actions, just compare `grid.activeCell` to a target).
- Phase 6: more selection challenges (row, range, table).
- Phase 6: formatting family. Needs new `GridAction` kinds and reducer cases for applying a format.
- Phase 6: sort/filter family. Needs sort and filter actions plus a visible-rows model.
- Phase 6: a challenge picker or a sequential run list.
- Phase 7: practice mode. Mode toggle, and `practiceNotes` surfaced in the result card after completion only.
- Phase 8: serializable versioned run result and a client event digest.

## Soon

- Keyboard interaction. The grid is pointer-only today, so the "fast route" a practice note describes cannot actually be taken.
- Drag-to-select a range. Range selections are only reachable programmatically right now.
- Deploy to Vercel.

## Later

- Fixed-time mode with partial progress scoring.
- Simple formula challenges.
- Official daily challenge shape.
- Profile and account planning.
- Real leaderboard backend.
- Replay and event viewer.
- Measured anti-cheat.
- Themes, once the design tokens have settled.

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
- Full global leaderboard before the core loop works.
- Full anti-cheat before the core loop works.
- Complex achievements before the core loop works.
- Theme marketplace.
- Sound system before the core loop works.
