# Backlog

## Done

Every phase of `IMPLEMENTATION_PLAN.md` (0-8), then the 2026-07-13 gameplay expansion batch:

- Full keyboard control of the grid, challenge-gated formatting shortcuts included.
- Sprint 5 / Sprint 10 task-count sessions with skip and per-length records.
- 30s / 60s fixed-time sessions with countdown, buzzer grading, per-duration records.
- Result cards with a New PR badge and per-task session breakdowns.
- 23 challenges across five families, including two mixed (composite) challenges.
- Local run history and profile stats at `/profile`.
- 16 theme presets at `/settings`, applied before first paint.
- 297 unit tests, 34 e2e tests.

## Immediate

- **Playtest the sessions.** Which mode is the fun one: single, sprint, or timed? That answer decides everything below. Nobody has judged feel.
- **Deploy to Vercel.** Build passes, no env vars. Steps in `IMPLEMENTATION_PLAN.md`.
- **A second dataset.** All 23 challenges share the one Revenue grid, so positions can be memorised; the find-the-value navigation challenge is already weaker for it. `createRevenueGrid` takes options; a seeded generator is the natural shape.

## Soon

- More challenges per family once a second dataset exists, so variety comes from data as well as task.
- Per-task target times shown during sessions, so the player knows the pace to beat.
- Show the personal best on the run surface during a run, so the chase is visible.
- Idle/pause handling for the single-run clock (a tabbed-away run posts a slow time today).

## Later

- Simple formula challenges. `CellValue` has a `formula` variant; there is no parser.
- Official daily challenge shape.
- Replay viewer on the run result's event list.
- Accounts, then a real leaderboard backend with server-side revalidation of the deterministic validators.
- Measured anti-cheat, not before there is something to cheat at.
- Sound.

## Explicitly Not Early

- AI coach.
- Monetization.
- Mobile app.
- Excel/Google Sheets import or integration.
- Classroom / enterprise modes.
- Heavy onboarding or forced signup.
- Full global leaderboard or anti-cheat before the loop is proven fun.
- Complex achievements.
- Theme marketplace (themes are presets, chosen locally; that is the ceiling for now).
