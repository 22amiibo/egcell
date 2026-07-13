# Changelog

## 2026-07-12

Phase 0 and Phase 1 of `IMPLEMENTATION_PLAN.md`.

- Scaffolded the app: Next.js 16 App Router, React 19, TypeScript strict, Tailwind CSS v4, ESLint 9, Vitest + jsdom + Testing Library, Playwright + Chromium.
- Added the dark app shell and base design tokens. The route at `/` is still a placeholder, not the game.
- Added the grid domain model: addresses, ranges, cells, selection, sort/filter state, and grid actions.
- Added range helpers (`normalizeRange`, `rangesEqual`, `isAddressInRange`, `rangeCellCount`, `cellKey`, `columnLabel`) and grid selectors (`getCell`, `columnRangeWithinUsedRange`, `rowRangeWithinUsedRange`).
- Added the `Challenge` type and the first challenge, "Select the Revenue column", with its Revenue dataset, validation spec, and scoring config.
- 31 unit tests cover the range helpers, the selectors, and the challenge definition.
- Fixed `eslint.config.mjs`. It had wrapped `eslint-config-next` in the `FlatCompat` eslintrc shim, which threw `TypeError: Converting circular structure to JSON` before linting anything. Next 16 ships flat config arrays, so `eslint-config-next/core-web-vitals` and `eslint-config-next/typescript` are now imported directly. Dropped the `@eslint/eslintrc` dependency, which the shim was the only user of.
- Lint, test, typecheck, build, and e2e all pass.

## 2026-07-13

- Added the initial product strategy, architecture, implementation plan, current-state, decisions, backlog, and handoff docs.
- Defined the first playable target around the "Select the Revenue column" challenge.
- Chose a custom simplified grid first with a future grid adapter boundary.
- Chose local personal records before accounts or leaderboards.

