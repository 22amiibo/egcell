# Excel Speed Trainer Implementation Plan

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

### Phase 6: Expand Challenge Families

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

### Phase 7: Practice Mode Post-Run Suggestions

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

### Phase 8: Leaderboard Preparation

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

