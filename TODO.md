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

Then, on 2026-07-13, **Phase A of the Challenge Variant System**: the audit in `CURRENT_STATE.md`, the design in `ARCHITECTURE.md`, the phased plan in `IMPLEMENTATION_PLAN.md`, and five decisions in `DECISIONS.md`. Docs only; no code changed.

Challenge Variant System **Phases B-H** are also complete: seeded randomness and types, template registry migration, four generated dataset themes, generated single-family drills, seeded session queues, and generated mixed chains with named subgoal partial credit.

## Immediate

- **Phase I — playtest tuning.** Cut weak variants, calibrate generated target times and difficulty, and tune queue pacing from real runs.
- **Playtest the sessions.** Still unanswered and still important: which mode is the fun one — single, sprint, or timed? The answer should shape Phase I and could reorder everything before it.
- **Deploy to Vercel.** Build passes, no env vars. Steps in `IMPLEMENTATION_PLAN.md`.

## The Variant System, In Order

Detail per phase in `IMPLEMENTATION_PLAN.md`. Do not skip ahead: each phase's tests are what make the next one safe.

- **B-H — complete.** Seeded generation, datasets, four single families, queues, and mixed-chain subgoals are shipped.
- **I** — playtest tuning: cut the boring variants, calibrate difficulty and target times.

## Soon

- Per-task target times shown during sessions, so the player knows the pace to beat.
- Show the personal best on the run surface during a run, so the chase is visible.
- Idle/pause handling for the single-run clock (a tabbed-away run posts a slow time today).

## Later

- Official daily challenge: a published seed, which the variant system's `dailySeed` exists for.
- The three grid-blocked families, each needing a reducer phase before a template phase: structure edits (insert/delete rows and columns), fill/copy, and simple formulas. `CellValue` has a `formula` variant; there is no parser.
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
