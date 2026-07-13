# Architecture

> **Reading order (2026-07-13).** Everything up to "Deployment" describes the system as **built**: 23 hand-authored challenges on one fixed grid. The last section, **Challenge Variant Architecture**, describes the **planned** seeded-variant system that replaces hand-authoring as the way challenges arrive. None of it is implemented; it is what Phases B-I of `IMPLEMENTATION_PLAN.md` build. Where the two disagree, the variant section is the target and the earlier text is the present.

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

---

# Challenge Variant Architecture

**Status: designed, not built.** Phases B-I of `IMPLEMENTATION_PLAN.md` build it. Read this before adding any new challenge.

## Why

Today a challenge is a hand-written object literal that points at one fixed 6-row Revenue table. Twenty-three of them exist. Three things follow, and all three are ceilings rather than bugs:

- **The table can be memorised.** "Go to Dara's Units" is a lookup the first time and muscle memory the fifth. The game measures recall, not spreadsheet speed.
- **Every new task is hand-written.** Coordinates like `REVENUE_COL` are module constants of one dataset. A hundred challenges means a hundred literals, each an opportunity to ship an unplayable one.
- **Variety and fairness fight each other.** Session queues are deterministic slices of the challenge list precisely so that a sprint record means something. Shuffling the list would make a record partly a lucky draw.

The variant system fixes the first two without giving up the third. It replaces "a challenge is a literal" with "a challenge is what a template generates from a seed", and it keeps records honest by separating the thing a record is keyed to (the template at a difficulty) from the thing that varies (the seed).

## The Five Concepts

```text
Family      navigation | selection | formatting | sort-filter | mixed | (structure-edit, fill-copy, formula later)
  └─ Template     "select the column that holds {role}"          — reusable, versioned, deterministic
       └─ Variant     "Select the Revenue column." + a grid + a spec    — one seed's output
            └─ Validator   already exists; keyed by spec kind, never by id
                 └─ Queue      seeded, family-balanced, repetition-avoiding
```

**Family** is the broad skill. It already exists as `ChallengeFamily` and is what the validator dispatcher and the toolbar key off.

**Template** is a reusable, versioned, deterministic function from `(seed, difficulty, dataset)` to a variant. It owns the prompt sentence, the dimensions it may vary, the validation spec it emits, and the actions its solution needs. It is the unit a personal record is keyed to.

**Variant** is one template's output for one seed. Crucially:

```ts
export type ChallengeVariant = Challenge & { /* provenance fields */ };
```

A variant **is** a `Challenge`. `useGameRun`, `validateChallenge`, `scoreRun`, `Toolbar`, `SpreadsheetGrid`, and the record store keep working unchanged, because a variant is exactly what they already consume plus fields they can ignore. This is the whole migration lever: the new system produces the old type.

**Generator** is `(templateId, seed, difficulty, mode?) -> ChallengeVariant`. Same inputs, same template version: byte-identical output. No `Math.random`, no `Date.now`, no `Date` construction inside generation.

**Validator** is unchanged. `validateChallenge` already routes on `challenge.validation.kind` and never sees an id; a generated spec grades exactly as a hand-written one does. **There is no new validator registry.** The exhaustive switch in `validateChallenge.ts` is the registry, and adding a family without a validator is already a type error.

## The Rule That Makes It Safe

> **A template emits its grid and its validation spec from one schema, in one call.**

The failure mode this closes is the only one that can silently corrupt the game: a generated grid whose columns moved, graded by a spec that still thinks Revenue is column 2. Coordinates must never be constants and must never be recomputed by a second pass. The dataset generator returns the column layout it chose; the template reads target coordinates **only** from that returned layout.

```ts
const dataset = generateDataset(rng.fork("dataset"), themeId, shape);
const revenueCol = dataset.columnsByRole.amount;      // not REVENUE_COL
```

If a template cannot express its target in terms of a role the dataset actually placed, it must not generate a variant. It returns null and the queue draws again.

## Seeded Randomness

```ts
// src/domain/random/rng.ts
export type Rng = {
  next(): number;                                  // [0, 1)
  int(minInclusive: number, maxInclusive: number): number;
  pick<T>(items: readonly T[]): T;
  shuffle<T>(items: readonly T[]): T[];
  bool(probability?: number): boolean;
  /** An independent stream derived from this one's seed and a label. */
  fork(label: string): Rng;
};

export function createRng(seed: string): Rng;      // mulberry32 over an FNV-1a hash of the seed
```

`fork` is not a convenience, it is the determinism-stability mechanism. Dataset draws, target-selection draws, and distractor draws each take their own forked stream, so adding one draw to dataset generation later does not shift every subsequent target and silently rewrite what every existing seed means. Streams are named, not positional.

Seeds are canonical strings, composed and never parsed:

```ts
// src/domain/random/seeds.ts
export type ChallengeSeed = string;                                  // "q:sprint-5:d2:1732:t3"
export function queueSeed(mode, difficulty, run: string): ChallengeSeed;
export function taskSeed(queue: ChallengeSeed, index: number): ChallengeSeed;
export function dailySeed(isoDate: string): ChallengeSeed;           // future daily challenge
```

## Dataset Themes

A theme is data, not logic. It supplies column roles, plausible headers, and value pools. It never affects a validator except through the schema the generator hands back.

```ts
export type ColumnRole =
  | "category"   // East / West, Marketing / Ops       — the thing you filter by
  | "name"       // a person, a SKU, a project          — the thing you look up by
  | "amount"     // money                               — currency-formattable
  | "count"      // units, headcount, tickets           — whole numbers
  | "rate"       // margin, conversion                  — percent-formattable
  | "status"     // Complete / Pending                  — a small closed set
  | "date"       // an ISO date                         — date-formattable
  | "note";      // free text                           — a distractor by nature

export type DatasetTheme = {
  id: string;                       // "sales-pipeline"
  label: string;
  /** The columns this theme can offer. The generator samples and orders a subset. */
  columns: Array<{
    role: ColumnRole;
    header: string;                 // "Revenue", "Spend", "Score"
    type: "text" | "number" | "date";
    numberFormat?: NumberFormat;
    values?: readonly string[];     // categorical pool, for text roles
    range?: [number, number];       // numeric pool bounds
  }>;
};
```

Ship first: `sales-pipeline`, `expenses`, `projects`, `customers`. Then `inventory`, `grades`, `employees`, `marketing-campaign`, `sports-stats`, `game-items`. A theme is roughly forty lines of data and costs nothing to add once the generator exists.

**Themes must not encode task difficulty.** A theme with longer header words is not a harder challenge, it is an annoying one.

## Difficulty

Difficulty is a preset that pins the **shape** of the work, because personal-record fairness depends on two variants at the same difficulty being the same amount of work:

```ts
export type DifficultyPreset = {
  difficulty: ChallengeDifficulty;      // 1..5, the existing type
  rows: [min: number, max: number];
  cols: [min: number, max: number];
  distractorColumns: [min: number, max: number];
  /** Similar-looking headers ("Revenue" next to "Revenue LY"). */
  confusables: boolean;
  /** Blank cells or a blank row inside the block, so edge-jumps stop early. */
  blanks: boolean;
  /** Steps in a mixed chain. 1 for every single-family family. */
  chainLength: [min: number, max: number];
  tableOffset: boolean;                 // the table does not start at A1
};
```

Difficulty comes from more rows, more columns, less obvious target position, more steps, distractors, confusable labels, and time pressure. **It never comes from a vaguer prompt.** A prompt that makes the player guess what is being asked is a bug, not a difficulty 5.

## Variant Dimensions

Each template declares what it may vary. This is documentation the queue can read, and the seam repetition-avoidance keys off:

```ts
export type VariantDimensions = {
  themeId: string;
  rowCount: number;
  colCount: number;
  columnOrder: ColumnRole[];
  targetRole?: ColumnRole;              // which column the task is about
  targetRowKind?: "first" | "last" | "byName" | "byRank";
  sortKey?: ColumnRole;
  sortDirection?: SortDirection;
  filterRole?: ColumnRole;
  filterValue?: string | number;
  formatKind?: NumberFormat | "bold";
  headerIncluded?: boolean;
  distractorRoles: ColumnRole[];
  chainLength: number;
};
```

The variant carries the dimensions it was generated with. The queue reads `templateId`, `targetRole`, and `themeId` from them to avoid repeating itself, and tests read them to prove a template actually varies what it claims to.

## Eligibility

A generated variant is **rejected, not shipped**, unless every check passes. These are the registry tests that exist today, promoted from a suite that runs on 23 literals to a gate that runs on every generated variant:

| Check | Why |
| --- | --- |
| Target range lies inside the grid | A spec pointing off the grid can never be satisfied |
| The initial grid does not already satisfy the validator | Already a registry test; the classic unplayable challenge |
| `allowedActions` covers every part of the spec | Already a registry test; otherwise the toolbar hides the only route |
| The prompt names only headers the dataset actually has | A generated prompt referencing a column that got sampled out is unsolvable |
| The prompt names no shortcut | Already a registry test; the fast route is the game |
| A sort target has ≥2 distinct values | Otherwise any order satisfies it |
| A filter predicate matches ≥1 and fewer than all data rows | Otherwise the answer is "do nothing" or "everything" |
| A formatting target does not already carry the required format | Same class as "starts complete", per cell |
| A navigation target is unique, or the spec accepts a target set | "The first numeric value" must have exactly one answer |
| The variant differs from the recent window | See below |

Eligibility runs inside generation, in the domain, with no React. A template whose draw fails a check returns null; the generator re-draws with the next seed in the stream, up to a bounded number of attempts, then falls back to a lower difficulty preset. **Bounded, so generation always terminates.**

## Repetition Avoidance

Monkeytype repeats words. Repetition is not the enemy; *patterns* of repetition are. The queue keeps a rolling window of the last few picks and rejects a draw that breaks any rule, re-drawing up to a bounded attempt count and then accepting whatever it has (termination beats purity):

- No template more than twice in a row, and no more than a third of a queue.
- No target column role three times in a row.
- At most two dataset themes per session, so the player is not re-reading a new table every eight seconds — orientation time is not the skill being drilled.
- Every family in the pool appears at least once in a 10-task sprint.
- A timed queue prefers templates whose `targetSeconds` at that difficulty fit inside the remaining clock.

## The Task Queue

```ts
export type RunModeKind = "single" | "practice" | "sprint" | "timed" | "daily";

export type TaskQueueRequest = {
  mode: RunModeKind;
  seed: ChallengeSeed;
  difficulty: ChallengeDifficulty;
  taskCount?: number;                   // sprint
  durationSeconds?: number;             // timed
  families?: ChallengeFamily[];         // practice targeting
};

export type TaskQueue = {
  version: string;                      // bumping invalidates comparability, deliberately
  seed: ChallengeSeed;
  mode: RunModeKind;
  tasks: RunTask[];
};

export type RunTask = { index: number; variant: ChallengeVariant };
```

Same seed, same queue version → same queue. A timed queue cannot know how many tasks the player will reach, so it generates a bounded overshoot (`ceil(duration / fastestTargetSeconds) + slack`) and the player consumes a prefix. Determinism survives; nothing is generated mid-run.

## Personal Records Stay Honest

This is the part that can quietly ruin the game, so it is spelled out.

**A record is keyed by what does not vary.** `Challenge.id` and `Challenge.seed` are already separate fields, and `PersonalRecord` already stores both the id it is keyed by and the seed it was set on. The variant system uses that seam exactly as it was built:

```ts
variant.id   = `${templateId}@${templateVersion}:d${difficulty}`   // the record key
variant.seed = taskSeed(queueSeed, index)                          // the instance
```

So a personal best is "my fastest run of *this drill at this difficulty*", not "my fastest run of this exact grid". That is the Monkeytype bargain: the words change, the test does not.

Two consequences, both non-negotiable:

1. **Time-based records demand bounded work within a difficulty.** Two variants of one template at one difficulty must be the same *amount* of work — same target size, same step count, row count inside one band. A test asserts this per template, because if it drifts, a PR becomes a lucky seed.
2. **Session records must chase score, not elapsed time.** They already do (`SessionRecord.bestScore`). This is what makes a seeded, varied sprint queue fair where a shuffled list would not have been: `scoreRun` already normalises each task's speed against *that task's own* `targetSeconds`, so a queue of three hard tasks and a queue of three easy ones pay out comparably. A sprint *time* record would not survive randomisation and must never be introduced.

The 2026-07-13 decision "session queues are deterministic slices of the challenge list" is superseded on that basis — see `DECISIONS.md`. Its reasoning stands and is honoured a different way: not by freezing the queue, but by scoring each task against its own target.

The existing 23 challenges migrate as **fixed templates**: one template, one pinned seed, `id` unchanged. Their records survive untouched.

## File Architecture

Adapted to this repo, which keeps pure logic in `src/domain`, content in `src/data`, and colocates tests next to source. There is no `tests/` tree and this does not add one.

```text
src/
  domain/
    random/
      rng.ts                    seeded RNG, fork
      rng.test.ts
      seeds.ts                  seed composition
    datasets/
      datasetTypes.ts           ColumnRole, DatasetTheme, GeneratedGrid
      generateDataset.ts        theme + shape + rng -> GeneratedGrid (grid + columnsByRole)
      generateDataset.test.ts
    challenges/
      challengeTypes.ts         EXISTING. Gains nothing it does not need.
      variantTypes.ts           ChallengeTemplate, ChallengeVariant, VariantDimensions
      difficulty.ts             DifficultyPreset table
      eligibility.ts            checkVariant -> issues[]
      eligibility.test.ts
      generateVariant.ts        (templateId, seed, difficulty) -> ChallengeVariant | null
      generateVariant.test.ts
      templateRegistry.ts       id -> template; the one place a template is looked up
      templates/
        navigation.ts           a few templates per family, not one file per template
        selection.ts
        formatting.ts
        sortFilter.ts
        mixed.ts
        *.test.ts
    queue/
      queueTypes.ts             TaskQueue, RunTask, TaskQueueRequest
      buildTaskQueue.ts         seeded, balanced, repetition-avoiding
      buildTaskQueue.test.ts
    validation/                 UNCHANGED. Already spec-keyed, already exhaustive.
  data/
    datasets/
      themes.ts                 the theme content: sales-pipeline, expenses, projects, customers
    challenges/
      index.ts                  EXISTING 23. Become fixed templates in Phase C; stay playable throughout.
e2e/
  variants.spec.ts              one generated challenge per family, played to completion
```

## Test Architecture

Five categories, all in Vitest except the last:

1. **Generator determinism.** Same seed + template + version → deep-equal variant. Different seed → a different variant on at least one dimension the template claims to vary. Generation touches no clock and no global RNG (asserted by stubbing both to throw).
2. **Validator correctness against generated grids.** For each template: the generated target state passes; a near-miss (off-by-one range, wrong column, half-formatted range, reversed sort) fails; a normalised-but-equivalent selection passes.
3. **Eligibility.** Every check has a variant that trips it. A fuzz test generates N seeds × every template × every difficulty and asserts zero eligibility issues and zero already-complete starts.
4. **Queue variety.** Exact task count for sprints; no template more than twice consecutively; family mix present in a 10-task queue; timed queues contain no task whose target exceeds the clock; same seed → same queue.
5. **E2E.** One generated navigation challenge completed by keyboard, one generated selection challenge by drag, one formatting, one sort/filter, and one sprint over a generated queue.

The fuzz test in (3) is the load-bearing one: it is what lets a hundred variants ship without a hundred hand-written tests.

## What This Architecture Refuses

- **No AI in validation, ever.** Generation is a pure function of a seed; grading is a pure function of the grid.
- **No route grading.** Validators keep judging final state. Generation changes what the target is, never how it must be reached.
- **No prompt-difficulty.** Confusing sentences are not content.
- **No structure-edit, fill-copy, or formula families until the grid supports them.** The reducer has no insert/delete/fill/formula action today. Those families are designed but explicitly deferred; see `IMPLEMENTATION_PLAN.md`.
- **No lessons.** A variant is a drill. If it takes a paragraph to explain, it is the wrong variant.

