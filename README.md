# Excel Speed Trainer

Excel Speed Trainer is a planned open-source, browser-based speed game for spreadsheet actions. The intended feel is closer to Monkeytype than an Excel course: instant tests, clean dark UI, fast retries, local personal records, and a loop that makes players want one more run.

The core loop is:

```text
challenge -> spreadsheet/grid action -> validation -> time/score -> PR -> retry
```

V1 is intentionally not an Excel clone, AI tutor, classroom product, business SaaS app, or file import/export tool. It is a game for practicing spreadsheet muscle memory in a simplified Excel-like grid.

## Project Status

Planning docs have been created. The app has not been scaffolded yet.

The first playable build should include:

- Clean dark web app.
- Simplified Excel-like grid.
- One real challenge: "Select the Revenue column."
- Timer.
- Validator.
- Result card.
- Retry button.
- Local personal record.
- Styling polished enough to judge the feel.

## Required Reading For Future Agents

Before coding, read these files in order:

1. `PRODUCT_STRATEGY.md`
2. `ARCHITECTURE.md`
3. `IMPLEMENTATION_PLAN.md`
4. `CURRENT_STATE.md`
5. `DECISIONS.md`

Every coding session must update `CURRENT_STATE.md`. Major product or technical choices must update `DECISIONS.md`. Meaningful completed slices should update `CHANGELOG.md`, and every handoff should refresh `AGENT_HANDOFF.md`.

## Recommended Stack

- Next.js App Router.
- React.
- TypeScript.
- Tailwind CSS.
- Vercel deployment.
- Vitest for domain logic.
- Playwright for the core game loop.
- Local-first personal records for early builds.
- Custom simplified grid first, with an interface that allows a later grid engine swap.

## First Setup Commands

Run these from the repository root:

```bash
npm create next-app@latest . -- --ts --tailwind --eslint --app --src-dir --import-alias "@/*"
npm install
npm install -D vitest jsdom @testing-library/react @testing-library/user-event @testing-library/jest-dom playwright
npx playwright install chromium
npm run dev
```

If the scaffold command asks whether to continue in a non-empty directory, confirm only if these docs are the only existing project files.

## Forbidden Early Features

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

