# Architecture

## Summary

Excel Speed Trainer should start as a Next.js, React, TypeScript, and Tailwind app with a custom simplified grid. Domain logic must be isolated from UI so validators, scoring, challenge generation, personal records, and future leaderboard submissions can be tested without rendering React.

The first grid should be simple and purpose-built. It should support enough interaction fidelity for navigation, selection, formatting, sort/filter, and formulas over time, while hiding implementation details behind a `GridEngineAdapter` so a more capable spreadsheet engine can replace or augment it later.

## Recommended Folder Structure

```text
src/
  app/
    layout.tsx
    page.tsx
    globals.css
  components/
    game/
      GameShell.tsx
      ChallengePrompt.tsx
      TimerDisplay.tsx
      ResultCard.tsx
      RetryButton.tsx
      StatRow.tsx
    grid/
      SpreadsheetGrid.tsx
      ColumnHeader.tsx
      RowHeader.tsx
      CellView.tsx
      SelectionOverlay.tsx
  data/
    challenges/
      selectionRevenueColumn.ts
      index.ts
  domain/
    challenges/
      challengeTypes.ts
      challengeRegistry.ts
    grid/
      gridTypes.ts
      range.ts
      selectors.ts
      gridReducer.ts
      gridAdapter.ts
    validation/
      validatorTypes.ts
      validateSelection.ts
      validateFormatting.ts
      validateSortFilter.ts
      validateFormula.ts
    scoring/
      scoringTypes.ts
      scoreRun.ts
    records/
      personalRecords.ts
      recordTypes.ts
    runs/
      runTypes.ts
      runReducer.ts
      timer.ts
  hooks/
    useGameRun.ts
    useLocalPersonalRecords.ts
  lib/
    storage.ts
    ids.ts
  test/
    fixtures/
      revenueGrid.ts
```

Tests:

```text
src/domain/**/*.test.ts
src/components/**/*.test.tsx
e2e/main-speed.spec.ts
```

Documentation:

```text
README.md
PRODUCT_STRATEGY.md
ARCHITECTURE.md
IMPLEMENTATION_PLAN.md
CURRENT_STATE.md
DECISIONS.md
TODO.md
CHANGELOG.md
AGENT_HANDOFF.md
```

## Data Model: Challenges

Challenges are deterministic objects. They contain setup data, allowed interaction surfaces, validation rules, scoring metadata, and optional post-run learning copy for practice mode.

```ts
export type ChallengeFamily =
  | "navigation"
  | "selection"
  | "formatting"
  | "sort-filter"
  | "formula";

export type ChallengeMode = "main-speed" | "practice";

export type TimingPolicy =
  | { kind: "single-challenge"; targetSeconds: number }
  | { kind: "fixed-time"; durationSeconds: number };

export type Challenge = {
  id: string;
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
  practiceNotes?: PracticeNote[];
};
```

For the first challenge:

```ts
export const selectionRevenueColumnChallenge: Challenge = {
  id: "selection.revenue-column.v1",
  slug: "select-revenue-column",
  title: "Select the Revenue column",
  prompt: "Select the Revenue column.",
  family: "selection",
  difficulty: 1,
  seed: "revenue-column-v1",
  timingPolicy: { kind: "single-challenge", targetSeconds: 8 },
  initialGrid: createRevenueGrid(),
  allowedActions: ["select-cell", "select-range", "select-column"],
  validation: {
    kind: "selection",
    requiredRange: { start: { row: 0, col: 2 }, end: { row: 6, col: 2 } },
    requireEntireColumnWithinUsedRange: true
  },
  scoring: {
    basePoints: 1000,
    targetSeconds: 8,
    minimumCorrectnessForPr: 1
  },
  practiceNotes: [
    {
      title: "Fast route",
      body: "Click the Revenue column header or select any Revenue cell and use the column-select shortcut once keyboard support exists."
    }
  ]
};
```

## Data Model: Grid State

The grid model should represent a simplified workbook, not raw DOM state.

```ts
export type CellAddress = {
  row: number;
  col: number;
};

export type RangeAddress = {
  start: CellAddress;
  end: CellAddress;
};

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
```

## Grid Engine Adapter

UI components should not know whether the grid is custom or powered by a later spreadsheet engine.

```ts
export type GridEngineAdapter = {
  getState(): GridState;
  dispatch(action: GridAction): GridState;
  subscribe(listener: (state: GridState) => void): () => void;
};
```

Early implementation can use a reducer-backed adapter. Later implementation can wrap a richer grid engine while preserving challenge validation and scoring APIs.

## Validator Architecture

Validation is deterministic and domain-level.

```ts
export type ValidationResult = {
  isComplete: boolean;
  correctness: number;
  completionPercent: number;
  accuracy: number;
  messages: ValidationMessage[];
};

export type ChallengeValidator = {
  kind: ValidationSpec["kind"];
  validate(input: {
    challenge: Challenge;
    grid: GridState;
    run: RunState;
  }): ValidationResult;
};
```

Validation families:

- `selection`: final selection or active range matches target.
- `navigation`: active cell matches target.
- `formatting`: cells in target range have required format.
- `sort-filter`: visible rows and row order satisfy predicates.
- `formula`: computed values match expected outputs; formula string matching is allowed only for early constrained tasks.

For ranked scoring, validators should prefer final grid state and avoid instant-fail behavior. Mistakes should affect time, accuracy, and possibly completion percent.

## Scoring Architecture

Scoring uses elapsed time, correctness, completion percent, and accuracy.

```ts
export type ScoreInput = {
  elapsedMs: number;
  correctness: number;
  completionPercent: number;
  accuracy: number;
  basePoints: number;
  targetSeconds: number;
};

export type ScoreResult = {
  score: number;
  speedMultiplier: number;
  correctnessMultiplier: number;
  completionMultiplier: number;
  accuracyMultiplier: number;
};
```

Baseline formula:

```text
speedMultiplier = clamp(targetSeconds / max(elapsedSeconds, 0.5), 0.2, 2.0)
qualityMultiplier = correctness^2 * (0.75 + 0.25 * accuracy)
completionMultiplier = completionPercent
score = round(basePoints * speedMultiplier * qualityMultiplier * completionMultiplier)
```

The `correctness^2` penalty prevents low-correctness loopholes. Completion percent supports fixed-time multi-step modes.

## Local Personal Records

V1 personal records live in `localStorage`.

Storage key:

```text
excel-speed-trainer:v1:personal-records
```

Record shape:

```ts
export type PersonalRecord = {
  challengeId: string;
  mode: ChallengeMode;
  bestScore: number;
  bestElapsedMs: number;
  bestCorrectness: number;
  achievedAt: string;
  seed: string;
};
```

Only store a PR when correctness meets the challenge's `minimumCorrectnessForPr`.

## Future Leaderboard Architecture

Do not build full leaderboards before the core loop works. Prepare the domain model so later submissions are possible.

Future submission shape:

```ts
export type LeaderboardSubmission = {
  challengeId: string;
  challengeVersion: string;
  seed: string;
  mode: "ranked";
  score: number;
  elapsedMs: number;
  correctness: number;
  completionPercent: number;
  accuracy: number;
  clientStartedAt: string;
  clientFinishedAt: string;
  eventDigest: string;
  replayEvents?: RunEvent[];
};
```

Future backend direction:

- Vercel deployment.
- Server route validates payload shape.
- Database stores submissions after deterministic revalidation.
- Official daily challenge uses server-published challenge id and seed.
- Anti-cheat adds event digest, replay sampling, suspicious timing flags, and versioned validators.

Do not require accounts until saved cloud scores or leaderboards exist.

## UI Component Architecture

Top-level page:

- `src/app/page.tsx` renders `GameShell`.

Game components:

- `GameShell`: owns mode, current challenge, run state, and layout.
- `ChallengePrompt`: compact prompt and run status.
- `TimerDisplay`: elapsed or fixed-time countdown.
- `SpreadsheetGrid`: grid rendering and user interaction.
- `ResultCard`: time, score, correctness, PR comparison, details disclosure.
- `RetryButton`: resets current challenge quickly.

Grid components:

- `SpreadsheetGrid`: keyboard and pointer event hub.
- `ColumnHeader`: supports selecting a column.
- `RowHeader`: supports selecting a row later.
- `CellView`: renders value and formatting.
- `SelectionOverlay`: renders selected range without changing layout.

Design direction:

- Dark-mode first.
- Dense but readable game surface.
- No marketing hero.
- No heavy onboarding.
- Clear active-cell and selection affordances.
- Stable grid cell sizes to avoid layout shifts.

## Testing Strategy

Domain tests first:

- Range normalization.
- Selection validation.
- Scoring formula.
- Local PR eligibility.
- Run reducer transitions.

Component tests:

- Result card renders simple metrics and details.
- Grid header click dispatches a column selection.
- Retry resets timer and result state.

End-to-end tests:

- Open app.
- See challenge prompt.
- Select Revenue column.
- Result card appears.
- Retry returns to active run.
- Local PR is shown after a completed run.

Manual checks:

- Chrome desktop.
- Keyboard focus remains visible.
- Dark UI has readable contrast.
- Grid interaction feels instant.

## Deployment

Use Vercel for hosting.

Initial deployment steps:

1. Push repository to GitHub.
2. Import project in Vercel.
3. Use default Next.js settings.
4. Set production branch.
5. Confirm `npm run build` passes.
6. Deploy.

No environment variables are required for the first playable build.

