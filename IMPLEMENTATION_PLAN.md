# Excel Speed Trainer Implementation Plan

> **Status (2026-07-13):** the original eight phases are complete, and a user-directed gameplay expansion batch landed on top of them: keyboard controls, sprint and fixed-time session modes, a result-screen upgrade, 23 challenges, local run history/profile, a polish pass, and theme settings. Everything from here down to "Handoff Rules For Future Agents" is a **historical record**.
>
> **The live plan is the last section of this file: Challenge Variant System.** Its Phase A (audit and architecture docs) is done. Phases B-I are the work. Read `ARCHITECTURE.md` § Challenge Variant Architecture before starting any of them.

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a clean first playable Excel Speed Trainer web app with one real speed challenge, deterministic validation, scoring, retry, and local personal records.

**Architecture:** Start with a custom reducer-backed grid and keep grid logic behind domain interfaces. Keep challenge, validation, scoring, run state, and personal record logic outside React so the gameplay loop can be tested without the UI.

**Tech Stack:** Next.js App Router, React, TypeScript, Tailwind CSS, Vitest, Testing Library, Playwright, Vercel.

## Global Constraints

- Browser-based web app.
- Vercel-first.
- Desktop-first.
- Chrome-first.
- Mac-first if platform tradeoffs are needed, but keep Windows in mind.
- No mobile focus for v1.
- No Microsoft Excel dependency.
- No Google Sheets dependency.
- No Excel file import/export for v1.
- No AI coach.
- No monetization.
- No pay-to-win.
- Open-source project.
- Users can play without signing up.
- Signup/accounts only later for saved scores and leaderboards.
- Clean dark-mode-first UI from the beginning.
- Minimal, fast, customizable later.
- It can look different from Excel, but interactions must feel close enough to Excel that players trust the skill transfer.
- Smoothness matters more than perfect Excel compatibility.
- The first version should be bigger/rougher rather than tiny/overpolished, but it still must look clean and attractive.

---

## Recommended Architecture

Build a Next.js app with a single game route at `/`. Keep the game loop in a React hook and keep pure rules in `src/domain`.

Core modules:

- `domain/grid`: grid state, addresses, ranges, actions, reducer.
- `domain/challenges`: challenge type definitions and registry.
- `domain/validation`: validators by challenge family.
- `domain/scoring`: score formula.
- `domain/runs`: timer and run lifecycle state.
- `domain/records`: local personal record comparison and persistence.
- `components/grid`: custom simplified spreadsheet grid.
- `components/game`: shell, prompt, timer, result, retry.

## Recommended Folder Structure

Create this structure during Task 1 and Task 2:

```text
src/
  app/
    layout.tsx
    page.tsx
    globals.css
  components/
    game/
      ChallengePrompt.tsx
      GameShell.tsx
      ResultCard.tsx
      RetryButton.tsx
      TimerDisplay.tsx
    grid/
      CellView.tsx
      ColumnHeader.tsx
      RowHeader.tsx
      SelectionOverlay.tsx
      SpreadsheetGrid.tsx
  data/
    challenges/
      index.ts
      selectionRevenueColumn.ts
  domain/
    challenges/
      challengeRegistry.ts
      challengeTypes.ts
    grid/
      gridAdapter.ts
      gridReducer.ts
      gridTypes.ts
      range.ts
      selectors.ts
    records/
      personalRecords.ts
      recordTypes.ts
    runs/
      runReducer.ts
      runTypes.ts
      timer.ts
    scoring/
      scoreRun.ts
      scoringTypes.ts
    validation/
      validateSelection.ts
      validatorTypes.ts
  hooks/
    useGameRun.ts
    useLocalPersonalRecords.ts
  lib/
    ids.ts
    storage.ts
  test/
    fixtures/
      revenueGrid.ts
e2e/
  main-speed.spec.ts
```

## Data Model For Challenges

Use this type shape in `src/domain/challenges/challengeTypes.ts`:

```ts
import type { GridActionKind, GridState, RangeAddress } from "@/domain/grid/gridTypes";

export type ChallengeFamily = "navigation" | "selection" | "formatting" | "sort-filter" | "formula";
export type ChallengeMode = "main-speed" | "practice";

export type TimingPolicy =
  | { kind: "single-challenge"; targetSeconds: number }
  | { kind: "fixed-time"; durationSeconds: number };

export type ValidationSpec =
  | {
      kind: "selection";
      requiredRange: RangeAddress;
      requireEntireColumnWithinUsedRange?: boolean;
    };

export type ChallengeScoringConfig = {
  basePoints: number;
  targetSeconds: number;
  minimumCorrectnessForPr: number;
};

export type PracticeNote = {
  title: string;
  body: string;
};

export type Challenge = {
  id: string;
  version: string;
  slug: string;
  title: string;
  prompt: string;
  family: ChallengeFamily;
  difficulty: 1 | 2 | 3 | 4 | 5;
  seed: string;
  timingPolicy: TimingPolicy;
  initialGrid: GridState;
  allowedActions: GridActionKind[];
  validation: ValidationSpec;
  scoring: ChallengeScoringConfig;
  practiceNotes: PracticeNote[];
};
```

## Data Model For Grid State

Use this type shape in `src/domain/grid/gridTypes.ts`:

```ts
export type CellAddress = { row: number; col: number };
export type RangeAddress = { start: CellAddress; end: CellAddress };

export type CellValue =
  | { kind: "blank" }
  | { kind: "text"; value: string }
  | { kind: "number"; value: number }
  | { kind: "date"; iso: string }
  | { kind: "formula"; formula: string; computed: CellValue };

export type CellFormat = {
  bold?: boolean;
  numberFormat?: "general" | "currency" | "percent" | "date";
  fill?: string;
};

export type GridCell = {
  address: CellAddress;
  value: CellValue;
  format: CellFormat;
};

export type GridSelection =
  | { kind: "none" }
  | { kind: "cell"; cell: CellAddress }
  | { kind: "range"; range: RangeAddress }
  | { kind: "row"; row: number }
  | { kind: "column"; col: number; usedRangeOnly: boolean };

export type SortState = {
  col: number;
  direction: "asc" | "desc";
};

export type FilterState = {
  col: number;
  op: "equals" | "greater-than" | "less-than";
  value: string | number;
};

export type GridState = {
  rowCount: number;
  colCount: number;
  usedRange: RangeAddress;
  columns: string[];
  rows: number[];
  cells: Record<string, GridCell>;
  activeCell: CellAddress;
  selection: GridSelection;
  hiddenRows: number[];
  sortState: SortState | null;
  filters: FilterState[];
};

export type GridActionKind = "select-cell" | "select-range" | "select-row" | "select-column";

export type GridAction =
  | { kind: "select-cell"; cell: CellAddress }
  | { kind: "select-range"; range: RangeAddress }
  | { kind: "select-row"; row: number }
  | { kind: "select-column"; col: number; usedRangeOnly: boolean };
```

## Validator Architecture

Use one validator dispatcher that routes by `challenge.validation.kind`.

```ts
export type ValidationResult = {
  isComplete: boolean;
  correctness: number;
  completionPercent: number;
  accuracy: number;
  messages: { kind: "success" | "error" | "info"; text: string }[];
};
```

First validator:

- `validateSelection(challenge, grid, run)` normalizes the current selection to a range.
- It compares that range with `requiredRange`.
- It returns complete/correct when the range matches.
- It returns incomplete with correctness `0` when a different range is selected.
- It keeps accuracy as `1` for v1 unless invalid action tracking exists.

## Scoring Architecture

Scoring input comes from validation and timer.

```ts
speedMultiplier = clamp(targetSeconds / max(elapsedSeconds, 0.5), 0.2, 2)
qualityMultiplier = correctness ** 2 * (0.75 + 0.25 * accuracy)
completionMultiplier = completionPercent
score = round(basePoints * speedMultiplier * qualityMultiplier * completionMultiplier)
```

This makes fast perfect runs score well and makes low-correctness runs unattractive.

## Local PR Architecture

Use `localStorage` through `src/lib/storage.ts`.

Storage key:

```text
excel-speed-trainer:v1:personal-records
```

Only update a PR when:

- Validation is complete.
- Correctness is greater than or equal to `minimumCorrectnessForPr`.
- New score is higher than previous score, or score ties and elapsed time is lower.

## Future Leaderboard Architecture

Prepare the run result shape now, but do not submit it to a server in v1.

Future ranked submission fields:

- Challenge id.
- Challenge version.
- Seed.
- Mode.
- Score.
- Elapsed time.
- Correctness.
- Completion percent.
- Accuracy.
- Client start and finish timestamps.
- Event digest.
- Optional replay event list.

Later server validation should re-run deterministic validators before accepting ranked submissions.

## UI Component Architecture

The first screen is the playable game. Do not build a landing page.

Layout:

- Top bar: app name, current mode, compact PR display.
- Main area: prompt, timer, grid.
- Result overlay/card after completion.
- Bottom/right compact stats if space allows.

Components:

- `GameShell`: state owner and layout.
- `ChallengePrompt`: current task text.
- `TimerDisplay`: elapsed time.
- `SpreadsheetGrid`: custom grid.
- `ResultCard`: score, time, correctness, PR delta, details disclosure.
- `RetryButton`: immediate reset.

## Testing Strategy

Test the pure domain heavily before UI polish:

- Range helpers.
- Grid reducer.
- Selection validator.
- Scoring.
- Personal record comparison.

Use Playwright for the final first-playable loop:

1. Open `/`.
2. Confirm prompt says "Select the Revenue column."
3. Click the Revenue column header.
4. Confirm result card appears.
5. Confirm retry starts a fresh run.

## Development Phases

### Phase 0: Project Scaffold And Tooling — COMPLETE (2026-07-12)

Scaffolded by hand rather than with `create-next-app`, because the directory already held the planning docs. See `DECISIONS.md`. `npm run lint` is still broken; see Known Issues in `CURRENT_STATE.md`.

**Goal:** Create the Next.js app, test tooling, and base dark design tokens.

**Files likely touched:**

- Create/modify `package.json`
- Create/modify `next.config.ts`
- Create/modify `tsconfig.json`
- Create/modify `eslint.config.mjs`
- Create/modify `postcss.config.mjs`
- Create/modify `src/app/layout.tsx`
- Create/modify `src/app/page.tsx`
- Create/modify `src/app/globals.css`
- Create `vitest.config.ts`
- Create `playwright.config.ts`

**Features built:**

- Next.js App Router project.
- Tailwind installed.
- Vitest configured with jsdom.
- Playwright configured for Chromium.
- Dark global shell styles.

**Acceptance criteria:**

- `npm run dev` starts the app.
- `npm run build` succeeds.
- `npm run test` succeeds with at least one smoke test.
- `npx playwright test` can launch Chromium against the local app.

**Risks:**

- Scaffolding in a non-empty directory can overwrite docs if done carelessly.
- Test scripts may be missing after scaffold and must be added.

**What not to build:**

- No game grid.
- No auth.
- No leaderboard.
- No landing page.

### Phase 1: Domain Model And First Challenge — COMPLETE (2026-07-12)

Two deviations, both recorded in `DECISIONS.md`: `createRevenueGrid()` lives in the challenge file and `src/test/fixtures/revenueGrid.ts` re-exports it, so production never imports from the test tree; and the challenge splits `id` from `version`. `src/domain/grid/selectors.ts` also ships `columnRangeWithinUsedRange`, which Phase 2's validator needs.

**Goal:** Add typed challenge and grid state models plus the "Select the Revenue column" fixture.

**Files likely touched:**

- Create `src/domain/grid/gridTypes.ts`
- Create `src/domain/grid/range.ts`
- Create `src/domain/grid/selectors.ts`
- Create `src/domain/challenges/challengeTypes.ts`
- Create `src/data/challenges/selectionRevenueColumn.ts`
- Create `src/data/challenges/index.ts`
- Create `src/test/fixtures/revenueGrid.ts`
- Create `src/domain/grid/range.test.ts`

**Features built:**

- Address and range helpers.
- Revenue dataset grid.
- First challenge object.

**Acceptance criteria:**

- `normalizeRange` returns sorted start/end coordinates.
- The first challenge has `id`, `version`, prompt, initial grid, validation spec, and scoring config.
- The required Revenue range points to the Revenue column in the used range.

**Risks:**

- Off-by-one confusion between visible row labels and zero-based internal row indexes.
- Column label display can drift from internal column index.

**What not to build:**

- No formula parser.
- No sort/filter engine.
- No random challenge generator.

### Phase 2: Grid Reducer And Selection Validation — COMPLETE (2026-07-12)

Added `src/domain/validation/validateChallenge.ts` as the dispatcher the Validator Architecture section calls for. A test pins that validation reads the spec, not the challenge id.

**Goal:** Make selection state deterministic and validate the first challenge.

**Files likely touched:**

- Create `src/domain/grid/gridReducer.ts`
- Create `src/domain/validation/validatorTypes.ts`
- Create `src/domain/validation/validateSelection.ts`
- Create `src/domain/runs/runTypes.ts`
- Create `src/domain/validation/validateSelection.test.ts`
- Create `src/domain/grid/gridReducer.test.ts`

**Features built:**

- Reducer actions for cell, range, row, and column selection.
- Selection-to-range normalization.
- Selection validator for the first challenge.

**Acceptance criteria:**

- Selecting column index `2` with `usedRangeOnly: true` validates complete.
- Selecting any other column validates incomplete.
- Selecting the exact Revenue range validates complete.
- Reducer returns new state without mutating the previous state.

**Risks:**

- Treating full infinite-column selection as different from used-range selection too early.
- Validator coupling to a specific challenge id instead of validation spec.

**What not to build:**

- No route efficiency scoring.
- No keyboard shortcut purity scoring.
- No instant-fail mistake system.

### Phase 3: Scoring And Local Personal Records — COMPLETE (2026-07-12)

Storage is injected into the record functions rather than imported, so the domain stays testable without a browser.

**Goal:** Score completed runs and save local PRs.

**Files likely touched:**

- Create `src/domain/scoring/scoringTypes.ts`
- Create `src/domain/scoring/scoreRun.ts`
- Create `src/domain/scoring/scoreRun.test.ts`
- Create `src/domain/records/recordTypes.ts`
- Create `src/domain/records/personalRecords.ts`
- Create `src/domain/records/personalRecords.test.ts`
- Create `src/lib/storage.ts`

**Features built:**

- Score formula.
- PR comparison.
- Safe localStorage wrapper.

**Acceptance criteria:**

- Perfect faster runs score higher than perfect slower runs.
- Low correctness sharply reduces score.
- PR updates only for complete eligible runs.
- Existing PR survives when a new run has lower score.

**Risks:**

- Score formula can reward very fast incomplete runs if completion/correctness multipliers are wrong.
- localStorage access can break server rendering if called outside client-only code.

**What not to build:**

- No cloud persistence.
- No accounts.
- No global leaderboard API.

### Phase 4: First Playable UI — COMPLETE (2026-07-12)

The clock starts when the grid appears, not on the first click; see `DECISIONS.md`. Client-only state is read through `useSyncExternalStore`. The grid is pointer-only: no keyboard, no drag-to-select yet.

**Goal:** Build the clean dark game surface and complete the first playable loop.

**Files likely touched:**

- Create `src/hooks/useGameRun.ts`
- Create `src/hooks/useLocalPersonalRecords.ts`
- Create `src/components/game/GameShell.tsx`
- Create `src/components/game/ChallengePrompt.tsx`
- Create `src/components/game/TimerDisplay.tsx`
- Create `src/components/game/ResultCard.tsx`
- Create `src/components/game/RetryButton.tsx`
- Create `src/components/grid/SpreadsheetGrid.tsx`
- Create `src/components/grid/ColumnHeader.tsx`
- Create `src/components/grid/RowHeader.tsx`
- Create `src/components/grid/CellView.tsx`
- Create `src/components/grid/SelectionOverlay.tsx`
- Modify `src/app/page.tsx`
- Modify `src/app/globals.css`

**Features built:**

- Dark app shell.
- Prompt and timer.
- Clickable column headers.
- Grid cells with stable dimensions.
- Result card after correct selection.
- Retry button.
- Local PR display.

**Acceptance criteria:**

- Opening `/` shows the game immediately.
- Prompt says "Select the Revenue column."
- Clicking the Revenue column header completes the run.
- Result card shows time, score, correctness, PR comparison, and retry.
- Retry resets result state and timer.
- UI is clean enough to evaluate product feel.

**Risks:**

- React timer updates can cause unnecessary grid re-renders.
- Grid layout can shift if headers or cells do not have stable dimensions.
- Result card can obscure the selected grid in a jarring way.

**What not to build:**

- No marketing hero.
- No settings drawer.
- No themes beyond initial tokens.
- No mobile layout work beyond not breaking catastrophically.

### Phase 5: End-To-End Verification And Handoff — COMPLETE (2026-07-12)

`e2e/main-speed.spec.ts` covers the loop in 7 Chromium tests, including a personal record surviving a reload. Playwright targets `localhost`, not `127.0.0.1`; see `DECISIONS.md`.

**Goal:** Prove the first playable loop works in Chrome and update project docs.

**Files likely touched:**

- Create `e2e/main-speed.spec.ts`
- Modify `package.json`
- Modify `CURRENT_STATE.md`
- Modify `CHANGELOG.md`
- Modify `AGENT_HANDOFF.md`
- Modify `IMPLEMENTATION_PLAN.md`

**Features built:**

- Playwright coverage for the core loop.
- Project scripts for unit and e2e tests.
- Updated docs showing completed phase status.

**Acceptance criteria:**

- `npm run test` passes.
- `npm run build` passes.
- `npx playwright test` passes.
- `CURRENT_STATE.md` records exactly what works.
- Completed phases are checked or marked in this plan.
- `AGENT_HANDOFF.md` lists exact commands for the next agent.

**Risks:**

- E2E selectors can become brittle if they target visual text instead of stable accessible labels.
- Docs can drift if not updated in the same session as implementation.

**What not to build:**

- No full leaderboard.
- No anti-cheat.
- No additional challenge families unless the first loop is already verified.

### Phase 6: Expand Challenge Families — COMPLETE (2026-07-12)

Eight challenges across navigation, selection, formatting, and sort/filter. `ValidationSpec` became a real discriminated union; `validateChallenge` switches exhaustively over it. The grid gained `set-format`, `sort-column`, `filter-column`, and `clear-filters`, plus drag-to-select, without which an arbitrary range could not be selected at all. `GridState` gained `headerRows`, because a sort has to know where the data starts.

**Goal:** Add small sets of navigation, selection, formatting, and sort/filter challenges after the first loop feels good.

**Files likely touched:**

- Modify `src/domain/challenges/challengeTypes.ts`
- Modify `src/data/challenges/index.ts`
- Add files in `src/data/challenges/`
- Add validators in `src/domain/validation/`
- Add tests in `src/domain/validation/`
- Extend `src/domain/grid/gridReducer.ts`
- Extend `src/components/grid/SpreadsheetGrid.tsx`

**Features built:**

- Navigation challenges.
- More selection challenges.
- Formatting challenges.
- Sort/filter state challenges.
- Challenge picker or simple sequential run list.

**Acceptance criteria:**

- Each new challenge has deterministic fixture data.
- Each validator has unit tests for pass and fail states.
- No challenge needs signup or server persistence.
- The default loop stays fast.

**Risks:**

- Adding too many challenge types before interaction quality is proven can blur the product.
- Formula and sort/filter logic can grow into a spreadsheet clone if not scoped.

**What not to build:**

- No advanced formulas.
- No imports.
- No AI-generated tasks.
- No replay viewer.

### Phase 7: Practice Mode Post-Run Suggestions — COMPLETE (2026-07-12)

PracticeNotes is only reachable from inside the result card, so no code path can show a hint during an active run. Records were already keyed by mode, so practice bests stay separate from speed bests.

**Goal:** Add practice mode that shows faster routes after completion without interrupting active runs.

**Files likely touched:**

- Modify `src/domain/challenges/challengeTypes.ts`
- Modify `src/components/game/GameShell.tsx`
- Modify `src/components/game/ResultCard.tsx`
- Add `src/components/game/PracticeNotes.tsx`

**Features built:**

- Mode toggle between main speed and practice.
- Post-run practice notes.
- No leaderboard scoring in practice mode.

**Acceptance criteria:**

- Practice mode uses the same validators.
- No hints appear during active run.
- Result card includes route notes after completion.

**Risks:**

- Copy can become instructional and slow down the Monkeytype-like feel.
- Mode switching can confuse PR eligibility if not explicit.

**What not to build:**

- No AI coach.
- No lesson tree.
- No school-style curriculum.

### Phase 8: Leaderboard Preparation — COMPLETE (2026-07-12)

`buildRunResult` and `eventDigest` exist and are exercised by the UI. Nothing is submitted anywhere: a test spies on `fetch` and asserts a completed run calls it zero times. The digest is not a security primitive and its docstring says so.

**Goal:** Prepare versioned run-result payloads while delaying real global leaderboards.

**Files likely touched:**

- Create `src/domain/runs/runResult.ts`
- Create `src/domain/runs/eventDigest.ts`
- Modify `src/domain/runs/runTypes.ts`
- Add tests in `src/domain/runs/`

**Features built:**

- Versioned challenge result shape.
- Client event digest placeholder based on recorded actions.
- Official daily challenge data shape.

**Acceptance criteria:**

- Run result can be serialized without UI state.
- Challenge id, version, seed, score, elapsed time, correctness, completion percent, and accuracy are present.
- No network submission happens by default.

**Risks:**

- Overbuilding anti-cheat before leaderboards exist.
- Treating client event digest as secure.

**What not to build:**

- No production leaderboard.
- No account system.
- No replay viewer.
- No full anti-cheat.

## Exact Starting Tasks For The First Implementation Agent

1. Read `PRODUCT_STRATEGY.md`, `ARCHITECTURE.md`, `IMPLEMENTATION_PLAN.md`, `CURRENT_STATE.md`, and `DECISIONS.md`.
2. Scaffold the Next.js app without deleting the docs:

   ```bash
   npm create next-app@latest . -- --ts --tailwind --eslint --app --src-dir --import-alias "@/*"
   ```

3. Add test dependencies:

   ```bash
   npm install -D vitest jsdom @testing-library/react @testing-library/user-event @testing-library/jest-dom playwright
   npx playwright install chromium
   ```

4. Add scripts to `package.json`:

   ```json
   {
     "scripts": {
       "dev": "next dev",
       "build": "next build",
       "start": "next start",
       "lint": "next lint",
       "test": "vitest run",
       "test:watch": "vitest",
       "e2e": "playwright test"
     }
   }
   ```

5. Implement Phase 1 and Phase 2 before polishing UI.
6. Build Phase 4 only after selection validation and scoring tests pass.
7. Update `CURRENT_STATE.md`, `CHANGELOG.md`, and `AGENT_HANDOFF.md` before stopping.

## Commands For Project Setup

```bash
npm create next-app@latest . -- --ts --tailwind --eslint --app --src-dir --import-alias "@/*"
npm install
npm install -D vitest jsdom @testing-library/react @testing-library/user-event @testing-library/jest-dom playwright
npx playwright install chromium
npm run dev
```

Recommended verification commands after each implementation slice:

```bash
npm run test
npm run build
npm run e2e
```

## Deployment Plan For Vercel

1. Confirm `npm run build` passes locally.
2. Push the repository to GitHub.
3. Import the repository into Vercel.
4. Use Vercel's detected Next.js settings.
5. Leave environment variables empty for first playable build.
6. Deploy preview.
7. Smoke test the preview in Chrome desktop.
8. Promote to production when the first playable loop works.

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
- Full global leaderboard before core loop works.
- Full anti-cheat before core loop works.
- Complex achievements before core loop works.
- Theme marketplace.
- Sound system before core loop works.

## Handoff Rules For Future Agents

- Read the required docs before coding.
- Keep changes scoped to the active phase.
- Use domain tests for validators, scoring, reducers, and records.
- Use Playwright for the complete user loop.
- Update `CURRENT_STATE.md` every coding session.
- Update `DECISIONS.md` for major product or technical decisions.
- Mark completed phases in this file.
- Update `CHANGELOG.md` for meaningful completed slices.
- Update `AGENT_HANDOFF.md` with what changed, what remains, known issues, and exact commands.

---

# Challenge Variant System

**This is the live plan.** Design: `ARCHITECTURE.md` § Challenge Variant Architecture. Goal: many more randomised Excel-like speed challenges, without the game becoming messy, repetitive, or impossible to validate.

The five gates run after every phase and all five must pass before the phase is done:

```bash
npm run lint && npm test && npm run typecheck && npm run build && npm run e2e
```

Two rules hold across every phase below:

- **The game stays playable at every commit.** The 23 hand-authored challenges keep working until generated ones demonstrably replace them, and their personal records are never invalidated.
- **No new challenge variants ship before the architecture that validates them.** Phases B through D produce zero new player-visible tasks.

## Phase A: Audit And Architecture Docs — COMPLETE (2026-07-13)

**Goal:** Understand the current challenge system, write down what stops it scaling, and design the variant system. No app behaviour changes.

**Done:** `ARCHITECTURE.md` gained the Challenge Variant Architecture section. This plan gained Phases A-I. `CURRENT_STATE.md` gained the limitations audit. `DECISIONS.md` gained four decisions, one of which supersedes the deterministic-slice session queue. `TODO.md` and `AGENT_HANDOFF.md` point at Phase B.

**Files touched:** docs only. Zero source files, zero tests, zero behaviour change.

## Phase B: Seeded RNG And Core Types

**Goal:** A deterministic random source and the types the rest of the system is written against. Nothing player-visible.

**Files:**

- Create `src/domain/random/rng.ts`, `rng.test.ts`
- Create `src/domain/random/seeds.ts`, `seeds.test.ts`
- Create `src/domain/challenges/variantTypes.ts`
- Create `src/domain/challenges/difficulty.ts`, `difficulty.test.ts`

**Work:**

- `createRng(seed: string): Rng` — mulberry32 over an FNV-1a hash of the seed string. `next`, `int`, `pick`, `shuffle`, `bool`, `fork(label)`.
- `fork` derives a child stream from `hash(parentSeed + ":" + label)`, so streams are named rather than positional and adding a draw in one stage cannot shift another.
- Seed composition: `queueSeed`, `taskSeed`, `dailySeed`. Seeds are canonical strings, composed and never parsed.
- `ChallengeTemplate`, `ChallengeVariant` (`= Challenge & {...}`), `VariantDimensions`, `GenerationContext`, `EligibilityIssue`.
- The five `DifficultyPreset` rows.

**Acceptance:**

- Same seed produces the same sequence, across two separately-constructed RNGs.
- Different seeds diverge within the first three draws.
- `shuffle` is a permutation, not a partial one; `int` is inclusive at both ends; `pick` never returns undefined on a non-empty array.
- A forked stream is independent: draining the parent does not change the child.
- `ChallengeVariant` is assignable to `Challenge` (a type-level test, `expectTypeOf` or an assignment in a test file).

**Tests:** determinism, distribution sanity (no draw is impossible), fork independence, `int` boundary inclusivity, seed composition round-trips to a stable string.

**Risks:** an RNG that looks deterministic but is seeded from object identity or insertion order. Guard: construct two RNGs from the same string literal in separate `it` blocks and compare 1000 draws.

**Do not build:** templates, datasets, queue, any UI.

**Commit:** `Add seeded RNG and challenge variant types`

## Phase C: Template And Family Registries, With The 23 Migrated

**Goal:** Every existing challenge is reachable through the template registry, and the game plays exactly as it does today.

**Files:**

- Create `src/domain/challenges/templateRegistry.ts`, `templateRegistry.test.ts`
- Modify `src/data/challenges/index.ts`
- Modify `src/components/game/GameShell.tsx` (picker reads the registry)

**Work:**

- A registry mapping template id → `ChallengeTemplate`. One lookup function, no second source of truth.
- Wrap each of the 23 hand-authored challenges as a **fixed template**: one pinned seed, `generate` returns the existing literal, `id` and `seed` unchanged.
- Family registry: family → the templates in it, plus the `GridActionKind`s that family's solutions need (today that map lives inside `challenges.test.ts`; it moves to the domain and the test reads it from there).
- The existing registry tests keep passing untouched. They are the eligibility gate in embryo.

**Acceptance:**

- `challenges` is derived from the registry rather than hand-listed, and produces the identical 23 in the identical order.
- Every existing personal record still resolves: `recordKey(challenge.id, mode)` is byte-identical to what it was.
- Sprint 5 faces exactly the same five tasks it did before this phase.
- All five gates pass with zero e2e changes.

**Tests:** registry round-trip (every id resolves to a template whose generate returns a variant with that id); order pin; the existing challenge-registry suite, unmodified.

**Risks:** the pinned head-of-list order. `DECISIONS.md` records that reordering `challenges` silently changes what Sprint 5 means. The order must survive this phase byte-for-byte; a test asserts the id sequence.

**Do not build:** generation from seeds, datasets, any behaviour change.

**Commit:** `Route the existing challenges through a template registry`

## Phase D: Dataset Theme Generator

**Goal:** Generate a real spreadsheet from a theme, a shape, and a seed. Still nothing player-visible.

**Files:**

- Create `src/domain/datasets/datasetTypes.ts`
- Create `src/domain/datasets/generateDataset.ts`, `generateDataset.test.ts`
- Create `src/data/datasets/themes.ts`, `themes.test.ts`

**Work:**

- `generateDataset(rng, themeId, shape) -> GeneratedGrid`: a `GridState` plus the `columnsByRole` map, header row, data row bounds, and the rows it drew.
- Four themes: `sales-pipeline`, `expenses`, `projects`, `customers`.
- Shape controls: row count, column count, column order, distractor columns, blanks, table offset, confusable headers.
- The returned `GridState` must satisfy everything the existing engine assumes: `headerRows` set, `usedRange` correct, `rowCount`/`colCount` at least the used range, cells keyed by `cellKey`.

**Acceptance:**

- Same seed + theme + shape → deep-equal grid.
- Every generated grid passes an invariant check: used range within row/col count, no cell outside the used range, every header non-empty and unique, `columnsByRole` points only at columns that exist.
- A numeric column drawn for a sort target has at least two distinct values.
- Themes are pure data: swapping a theme changes headers and values and nothing else about the grid's shape.

**Tests:** determinism; the invariant check as a fuzz over 200 seeds × 4 themes × 5 difficulties; theme content (every column has a header, a type, and a pool).

**Risks:** a generated grid that breaks a silent assumption of the sort/filter reducer (it recomputes hidden rows from `dataRowBounds`, which is `usedRange.start.row + headerRows`). Guard: the fuzz test dispatches a sort and a filter at every generated grid and asserts the reducer does not throw and the header does not move.

**Do not build:** templates that use the datasets yet. Land the generator and its fuzz test alone.

**Commit:** `Generate seeded datasets from reusable themes`

## Phase E: Navigation And Selection Variants

**Goal:** The first generated challenges a player can actually meet. Two families, because they are the two with no grid-mutation risk.

**Files:**

- Create `src/domain/challenges/generateVariant.ts`, `generateVariant.test.ts`
- Create `src/domain/challenges/eligibility.ts`, `eligibility.test.ts`
- Create `src/domain/challenges/templates/navigation.ts`, `selection.ts`, and their tests
- Modify `src/components/game/GameShell.tsx` (picker offers templates; a re-roll gives a new seed)

**Work:**

- `generateVariant(templateId, seed, difficulty)`: fork the RNG, generate a dataset, hand the template its `GenerationContext`, run eligibility, return the variant or null.
- Navigation templates: last filled cell in a column; first filled cell in a row; edge of the data region; a labelled cell (by name); first blank cell under a column; last row of the table; first numeric value in a column.
- Selection templates: a column by role; a row by role; the whole table; the data values under a header; the header row; a rectangular subrange.
- Every template emits its coordinates from `dataset.columnsByRole`, never from a constant. This is the rule the whole design rests on.
- Prompts are built from the dataset's actual headers.

**Acceptance:**

- A generated navigation challenge is completable by keyboard alone.
- A generated selection challenge is completable by drag alone.
- Eligibility rejects: a target off-grid, an already-satisfied start, a prompt naming a column the dataset did not sample, an ambiguous "first numeric value" with two answers.
- A rejected draw re-draws and generation still terminates (bounded attempts, asserted).

**Tests:** determinism per template; near-miss validation (off-by-one range, wrong column, header included when it should not be); the eligibility fuzz (every template × 5 difficulties × 100 seeds → zero issues, zero already-complete); e2e for one generated navigation and one generated selection challenge.

**Risks:** validator/prompt divergence. A prompt that says "Revenue" while the spec points at the Units column is undetectable by type-checking and lethal to trust. Guard: an eligibility check that re-derives the target column *from the prompt's header text* and asserts it equals the spec's column.

**Do not build:** formatting, sort/filter, mixed, or queue changes. Single-challenge play only.

**Commit:** `Generate navigation and selection variants from seeds`

## Phase F: Formatting And Sort/Filter Variants

**Goal:** The two families that mutate the grid, generated.

**Files:**

- Create `src/domain/challenges/templates/formatting.ts`, `sortFilter.ts`, and tests
- Modify `src/domain/datasets/generateDataset.ts` if a format-stripped variant of a grid is needed

**Work:**

- Formatting templates: currency on an amount column; percent on a rate column; bold the header row; date format on a date column; whole-number format on a count column; bold a category column.
- Sort/filter templates: sort a numeric column either direction; sort text A-Z; filter a category to one of its values; filter a status; filter above/below a threshold drawn from the data.
- A formatting target must start **without** the required format (the existing "must not start complete" rule, per cell). The dataset generator gains a per-column "start unformatted" flag, exactly as `createRevenueGrid({ revenueFormat: "general" })` does today.
- A filter value is drawn from the data so it always matches ≥1 and < all rows.

**Acceptance:**

- Sorting a generated grid moves whole rows and leaves the header alone (the reducer already guarantees this; the test asserts it on generated shapes).
- A filter target always has a non-trivial answer.
- A generated formatting challenge cannot start complete, at any seed.

**Tests:** near-miss (reversed sort, one unformatted cell in the range, filter one row off); the row-integrity check after a generated sort (every data row's values still belong to the same original record); eligibility fuzz extended to both families; e2e for one generated formatting and one generated sort/filter challenge.

**Risks:** a sort target column whose values are all equal makes any order correct. Eligibility rejects it; a test proves the rejection fires.

**Do not build:** mixed chains. Queue still untouched.

**Commit:** `Generate formatting and sort/filter variants from seeds`

## Phase G: Seeded Task Queues

**Goal:** Sprint and timed modes run generated, family-balanced, repetition-avoiding queues.

**Files:**

- Create `src/domain/queue/queueTypes.ts`, `buildTaskQueue.ts`, `buildTaskQueue.test.ts`
- Modify `src/components/game/SessionRun.tsx` (consume a queue instead of `taskChallengeAt`)
- Modify `src/domain/sessions/sessionResult.ts` (drop `taskChallengeAt`)
- Modify `src/hooks/useLocalSessionRecords.ts` and `src/domain/sessions/sessionRecords.ts` (records key on mode **and** difficulty)

**Work:**

- `buildTaskQueue(request) -> TaskQueue`: seeded, family-mixed, repetition-avoiding, eligibility-respecting.
- Timed queues generate a bounded overshoot and the player consumes a prefix. Nothing is generated mid-run.
- Timed mode prefers short targets; sprint mode allows longer ones.
- Practice mode may target a family list.
- Session record keys gain the difficulty. The old session record book is not comparable to seeded queues and is dropped **once**, under a new storage version, with a line in `DECISIONS.md` — per-challenge records are untouched.

**Acceptance:**

- Same seed → same queue, asserted on a 10-task sprint.
- Sprint 5 has exactly 5 tasks; Sprint 10 exactly 10.
- No template appears more than twice consecutively, nor in more than a third of a queue.
- A 10-task queue contains at least three families.
- No timed-30 task has a target time exceeding the clock.
- A session score is comparable across seeds: two queues at one difficulty have total target times within a stated band (a test pins the band).

**Tests:** all of the above; plus a regression that per-challenge personal records still resolve after the session-record migration.

**Risks:** the repetition-avoidance loop failing to terminate on a small template pool. Guard: bounded attempts, then accept the draw; a test with a two-template pool asserts termination.

**Do not build:** partial credit, subgoals, daily challenge.

**Commit:** `Run sprint and timed modes on seeded task queues`

## Phase H: Mixed Chains And Partial Credit — COMPLETE (2026-07-13)

**Goal:** Two- and three-step chains, with subgoal progress that timed mode can pay out on.

**Done:** one deterministic, order-independent generated mixed template; named subgoal validation; session result propagation and breakdown; timed buzzer partial-credit integration; and eligibility rejection for incompatible composite final-state requirements. `scoreRun` and every leaf validator remain unchanged.

**Files:**

- Create `src/domain/challenges/templates/mixed.ts`, tests
- Modify `src/domain/challenges/challengeTypes.ts` (a `Subgoal` label per composite part)
- Modify `src/domain/validation/validateComposite.ts` (report per-part results)
- Modify `src/domain/validation/validatorTypes.ts` (`ValidationResult` gains an optional `subgoals`)
- Modify `src/components/game/SessionResultCard.tsx` (show subgoal progress)

**Work:**

- Mixed templates compose leaf specs from the single-family templates. The composite spec is already flat and already forbids nesting; this phase does not change that.
- `validateComposite` already averages part completion. It gains a per-part breakdown so a timed buzzer can pay for the part that got done, and the result card can say which.
- `PartialCreditResult` is that breakdown, not a new scoring path. `scoreRun` is unchanged.

**Acceptance:**

- A 2-step chain grades each part independently and completes only when both pass.
- A buzzer mid-chain pays completion percent equal to the fraction of parts done, and the result card names the unfinished one.
- Order of operations does not matter unless a template says it does.
- `scoreRun` is untouched, and its test suite is unmodified.

**Tests:** composite with one part done (0.5 completion); subgoal labels reach the result card; a generated chain is solvable in either order.

**Risks:** a chain whose steps interfere (sorting after filtering changes which rows are visible). Eligibility must reject chains whose parts are not independently satisfiable in at least one order. A test constructs an interfering pair and asserts rejection.

**Do not build:** structure-edit, fill-copy, or formula families. The grid still cannot insert, delete, fill, or evaluate.

**Commit:** `Add generated mixed chains with subgoal partial credit`

## Phase I: Playtest Tuning

**Goal:** Make it fun. This is the only phase whose acceptance criteria are subjective, and it is the point of all the others.

**Files:** template parameters, difficulty presets, target times, theme content, docs.

**Work:**

- Play every mode. Cut variants that are boring, ambiguous, or slow to read.
- Tune difficulty presets so a difficulty-3 variant of one template is genuinely the same work as a difficulty-3 variant of another.
- Tune target times per template so score is comparable across draws.
- Retire any hand-authored challenge a generated template subsumes.
- Update every doc.

**Acceptance:** a run feels like a speed drill, not a reading comprehension test. A player wants one more go.

**Tests:** whatever the tuning breaks.

**Risks:** tuning by taste with no measurement. Guard: the run history already records elapsed times per mode; use them.

**Do not build:** anything new.

**Commit:** `Tune generated challenge difficulty and pacing`

## Deferred Families

Designed in `ARCHITECTURE.md`, deliberately not planned above, because the grid cannot express them:

| Family | Blocked on |
| --- | --- |
| Structure edit (insert/delete row or column) | Reducer has no insert/delete action; `GridState` has no way to say a column moved |
| Fill / copy | No fill or paste action; no clipboard model |
| Simple formulas | `CellValue` has a `formula` variant, but nothing creates or evaluates one; no parser |

Each needs a reducer phase of its own before a template phase. Do not start one to add variety; variety comes from the four families that already work.
