# Decisions

> The five decisions below are **design decisions taken during Phase A of the Challenge Variant System**. No code implements them yet. Everything after them describes shipped behaviour.

## 2026-07-13: A Generated Variant Is A Challenge, Not A New Type

Decision: `ChallengeVariant = Challenge & { templateId, dimensions, eligibility flags, ... }`. The generator's output is the type the game already consumes.

Reasoning:

- `useGameRun`, `validateChallenge`, `scoreRun`, `Toolbar`, `SpreadsheetGrid`, and the record store all take a `Challenge` today. A parallel type would need a second code path through every one of them, and the two would drift.
- A variant genuinely is a challenge plus provenance. The extra fields — which template made it, what it varied, whether it is sprint- or leaderboard-eligible — are read by the queue and by tests, and ignorable by everything else.

Consequences:

- The variant system ships behind the existing engine with no change to the run loop.
- The 23 hand-authored challenges migrate as fixed templates: one pinned seed each, `id` unchanged, records untouched.

## 2026-07-13: A Template Emits Its Grid And Its Spec From One Schema, In One Call

Decision: dataset generation returns the column layout it chose (`columnsByRole`), and a template reads its target coordinates only from that. No template and no validation spec may refer to a column constant.

Reasoning:

- Today `REVENUE_COL = 2` is a module constant of the one dataset, and every spec is written against it. Randomise column order without changing that and a spec grades the wrong column, while type-checking cleanly and reading correctly in review. It is the one failure mode of this design that is both silent and fatal.
- Deriving the spec in a second pass over the generated grid is the same bug with extra steps: two derivations that must agree, and nothing forcing them to.

Consequences:

- A template that cannot express its target in terms of a role the dataset actually placed generates nothing, and the queue re-draws.
- An eligibility check re-derives the target column from the prompt's own header text and asserts it equals the spec's column, so a prompt and its validator cannot disagree.

## 2026-07-13: A Record Is Keyed To The Drill, Not To The Seed

Decision: a generated variant's `id` is `${templateId}@${version}:d${difficulty}`; its `seed` is the instance. Personal records stay keyed `${challengeId}:${mode}`, unchanged.

Reasoning:

- Key a record by the seed and every run is a first-ever PR. The chase, which is the whole emotional loop, dies.
- `Challenge` already splits `id` from `seed`, and `PersonalRecord` already stores both. The seam was built for this and needs no new storage shape.
- It is the Monkeytype bargain: the words change, the test does not. A best time means "my fastest run of this drill at this difficulty".

Consequences:

- Two variants of one template at one difficulty must be the **same amount of work**: same target size, same step count, row count within one band. A test asserts it per template, because if that drifts a PR becomes a lucky seed.
- Bumping a template's version starts a new record book for it, deliberately.

## 2026-07-13: Seeded Queues Supersede Deterministic Slices, Because Score Is Already Draw-Normalised

Decision: sprint and timed queues become seeded, family-balanced, and repetition-avoiding. This supersedes "Session Queues Are Deterministic Slices Of The Challenge List" below.

Reasoning:

- That decision's reasoning was right as far as it went: a *time* record over a random draw is a lottery, because three navigation tasks are quicker than three sort tasks.
- But sessions do not record time, they record **score** — and `scoreRun` already divides each task's target seconds by its elapsed seconds. Speed is normalised per task, against that task's own par. A hard draw pays out like an easy one.
- So the fairness that freezing the queue bought is available without freezing it. Freezing was the expensive way to get the same property, and it capped variety permanently.

Consequences:

- The first eight challenges stop being pinned. `taskChallengeAt` goes away in Phase G.
- **A sprint elapsed-time record must never be introduced.** It would not survive randomisation. Sessions chase score; single runs chase time.
- Session records gain the difficulty in their key. The old session book is not comparable to a seeded queue and is dropped once, under a new storage version. Per-challenge records are untouched.
- Per-template target times become load-bearing, and must be tuned in Phase I rather than guessed.

## 2026-07-13: Difficulty Comes From The Table, Never From The Prompt

Decision: difficulty is a preset over grid shape — more rows, more columns, distractor columns, confusable headers, blanks, table offset, chain length, time pressure. Prompts are always as clear as they can be made.

Reasoning:

- This is a speed game. A prompt the player has to decode measures reading comprehension while the clock runs.
- Ambiguity is also the one difficulty knob that breaks validation: if the player cannot tell what is being asked, a correct answer can fail.

Consequences:

- Eligibility rejects an ambiguous target (two cells satisfying "the first numeric value") rather than shipping it as hard.
- Generation is bounded: a rejected draw re-draws a fixed number of times, then falls back to a lower difficulty preset. It always terminates.

## 2026-07-13: Cmd And Ctrl Are Both Jump Modifiers, With No Platform Sniffing

Decision: Cmd+Arrow and Ctrl+Arrow (and Cmd/Ctrl+A, Cmd/Ctrl+B) behave identically. Only Ctrl+Space and Shift+Space are single-modifier, because Cmd+Space belongs to Spotlight and never reaches the page.

Reasoning:

- Web spreadsheets accept both because platform sniffing is the flakiest code in any keyboard layer, and a Mac user with a PC keyboard exists.
- Nothing is lost: no Excel binding distinguishes Cmd+Arrow from Ctrl+Arrow in a way this game cares about.

Consequences:

- No user-agent checks anywhere. Tests fire `metaKey` and `ctrlKey` interchangeably and both must pass.

## 2026-07-13: Session Queues Are Deterministic Slices Of The Challenge List

> **Superseded by "Seeded Queues Supersede Deterministic Slices" above.** It describes what ships today and stays true until Phase G lands.

Decision: Task N of a sprint or timed session is always `challenges[N % length]`. No shuffling.

Reasoning:

- A sprint personal record is only meaningful if every attempt faces the same tasks in the same order. Random draws would make a "record" partly a lucky queue.
- Monkeytype randomises words, but its unit of skill is the keystroke, not the task. Here a lucky draw of three navigation tasks would beat an unlucky draw of three sort tasks on time alone.

Consequences:

- The first eight challenges are pinned at the head of the list in their exact order. Reordering the list is a breaking change to what Sprint 5 means, and the registry comment says so.
- Variety inside sessions comes from growing the pool, and later from a second dataset, not from shuffling.

## 2026-07-13: Sessions Bank Their Own Records, Tasks Inside Them Bank Nothing

Decision: Sprint and timed records live in their own storage bucket keyed by mode. A task completed inside a session never updates that challenge's single-run record. Run history and settings likewise live in their own buckets.

Reasoning:

- A task inside a sprint is played under different pressure than a single run; letting it set single-run PRs would pollute both books.
- Separate buckets mean a corrupt or outgrown shape in one store can never take down another, and each store validates what it reads.

Consequences:

- Four localStorage keys: personal records, session records, run history, settings. All versioned `v1`.
- `useGameRun` grew a `recordPersonalBest` option; sessions pass false.

## 2026-07-13: The Timed Deadline Is A Timeout Plus A Wall-Clock Check

Decision: A fixed-time session ends when the per-task timeout fires, or when any task completes with `Date.now()` already past the deadline, whichever happens first.

Reasoning:

- `setTimeout` is a lower bound, not a guarantee. A completion can land after the true deadline but before the delayed timer fires, and with only the timer the queue would advance into a task the clock had no room for, corrupting completion percent.
- Found by an adversarial review pass and reproduced with fake timers before fixing.

Consequences:

- A buzzer-beater completion a few milliseconds past the deadline still counts as completed and ends the session, which is generous by milliseconds and consistent.
- The interrupted task is graded exactly as the grid stands, so partial formatting pays its partial credit. That is also the documented limit of partial progress in timed mode: finer-grained subgoals would need validators to report per-step progress, and none do.

## 2026-07-13: Mixed Challenges Use A Flat Composite Spec

Decision: `ValidationSpec` gained a `composite` kind holding a list of leaf specs, every one of which must pass. A composite can never contain another composite.

Reasoning:

- Two-step tasks ("sort and bold") need grading, but a recursive tree of specs is architecture nobody asked for. Flat parts keep grading two or three plain checks.
- Progress is the mean of the parts, so the score pipeline needed no changes.

Consequences:

- The dispatcher's exhaustive switch gained one case; no leaf validator changed.
- The registry's allowed-actions test checks every part of a composite individually.

## 2026-07-13: A Theme Is A Full Token Reassignment, Applied Before First Paint

Decision: Theme presets reassign all nine design tokens as CSS variables on the document root. An inline boot script in the layout applies a saved theme before first paint; a module-singleton settings store applies live changes.

Reasoning:

- Every component already styles itself through the tokens, so swapping tokens restyles everything with zero component changes, which is what makes a preset a design choice rather than a tint.
- Without the boot script, a light-theme player sees a dark flash on every load. The script is generated from the same preset data the settings page uses, so the two cannot drift.
- The store is a module singleton because the applier (layout) and the picker (settings page) must share state; per-component stores would not notify each other.

Consequences:

- `<html>` carries `suppressHydrationWarning`, on that one element only, because the boot script styles it before hydration.
- Sixteen presets ship; a test pins that every preset fills every token with a well-formed color, since a missing token would silently inherit the previous theme.

## 2026-07-13: Grid Cells Take Primitives, Not An Address Object

Decision: `CellView` receives `row` and `col` as numbers instead of a `{ row, col }` object.

Reasoning:

- The cell is memoized and props are compared shallowly. A per-render address object defeated the memo, which was invisible under mouse play but meant keyboard play re-rendered all 96 cells on every keystroke.

Consequences:

- Only cells whose data actually changed re-render during keyboard play.
- Handlers build the address at event time, which allocates only on interaction.

## 2026-07-12: Validators Grade The Grid's End State, Never The Route

Decision: Every validator compares what the grid looks like when the player stops. None of them inspect how the player got there.

Reasoning:

- The product promises skill transfer to Excel. In Excel there are always several ways to do a thing, and the fast one is the point of the game.
- If a validator asked "did they click the toolbar button", then adding keyboard shortcuts later would silently break every challenge, and the player who used the fast route would be the one penalised.
- Grading end state means a mouse click, a toolbar press, and a future Ctrl+B all count the same.

Consequences:

- Keyboard support can be added without touching a single validator.
- A sort challenge is satisfied by the visible row order, not by `sortState`, so any route to that order counts.
- The one exception is deliberate: a sort challenge additionally requires that *something* was sorted or filtered, or an untouched grid could satisfy an ascending sort by luck.

## 2026-07-12: GridState Carries headerRows

Decision: `GridState` gained a `headerRows` count.

Reasoning:

- Sorting must move the data rows and leave the header where it is. Filtering must never hide the header.
- Neither is possible if the model cannot say where the header ends. `usedRange` alone does not distinguish a header from a first data row.

Consequences:

- `createRevenueGrid` sets `headerRows: 1`.
- A future headerless dataset sets it to 0, and sorting and filtering keep working with no code change.

## 2026-07-12: Drag-To-Select Was Required, Not Optional

Decision: The grid supports click-and-drag range selection.

Reasoning:

- Phase 6 adds a "select the whole table" challenge. Without dragging, a player has no way to select an arbitrary range at all, so the challenge would be unplayable. This was not a polish item; it was a blocker.
- A click always fires after a drag's pointerup. Left alone, it would collapse the range the player just dragged back down to a single cell, so the click after a drag is suppressed.

Consequences:

- Range selections are reachable by hand, not only in code.
- `pointerenter` checks `event.buttons`, because hovering with the mouse up also fires it and must not paint a selection.

## 2026-07-12: The Toolbar Shows Only What The Challenge Allows

Decision: `Toolbar` renders buttons filtered by the challenge's `allowedActions`, and renders nothing at all when the challenge allows none of them.

Reasoning:

- `allowedActions` already existed on `Challenge` and was doing nothing. Honouring it costs one line and makes the surface honest.
- A control that cannot help with the current challenge is noise at best, and a wrong turn at worst, in a game measured in seconds.

Consequences:

- Selection and navigation challenges show no toolbar.
- Adding a family means listing its actions on the challenge; the toolbar follows automatically.

## 2026-07-12: The Event Digest Is Not Security, And Says So

Decision: `eventDigest` is a plain FNV-1a hash over a canonical event string, and its docstring states at length that it proves nothing.

Reasoning:

- The plan's own risk list warns against "treating client event digest as secure". It is computed on the client, from client-controlled data, with a published algorithm and no secret. Anyone can forge one.
- It is still worth having: a future server can use it to recognise duplicate submissions and to check a replay against the summary it arrived with.
- The comment is long on purpose. The failure mode is a future contributor assuming the digest is anti-cheat and building on it.

Consequences:

- Real verification stays what it always was: re-run the deterministic validators on the server against the submitted events.
- The digest is versioned, so changing the canonical form cannot be mistaken for the same digest.

## 2026-07-12: The Clock Starts When The Grid Appears, Not On The First Click

Decision: A run's timer starts the moment the challenge is on screen, not when the player first interacts.

Reasoning:

- Monkeytype starts its clock on the first keystroke, and copying that here looks tempting.
- It would break scoring. In this game the action *is* the answer: the correct first click both starts and ends the run. Elapsed time would always be near zero, the speed multiplier would sit at its 2.0 cap on every run, and every correct run would score the same.
- The player's reading and aiming time is the skill being measured, so it belongs inside the clock.

Consequences:

- `useGameRun` starts the clock on the first client render rather than on the first action.
- Scores spread across a real range, and a faster run genuinely beats a slower one.
- A player who leaves the tab idle and comes back will post a slow time. Acceptable for now; a pause or an idle reset can come later if it turns out to matter.

## 2026-07-12: Client-Only State Is Read Through useSyncExternalStore

Decision: The personal record store and the run clock are exposed as external stores with a server snapshot, rather than loaded in a mount effect.

Reasoning:

- `localStorage` and `Date.now()` do not exist, or do not agree, during a server render. Reading them while rendering produces a hydration mismatch.
- The obvious fix is to load them in a `useEffect` and call `setState`. That works, but it costs an extra render and React Compiler's `react-hooks/set-state-in-effect` rule rejects it.
- `useSyncExternalStore` is built for exactly this: `getServerSnapshot` returns the empty store and a null clock, the browser reads the real values after hydration, and React reconciles.

Consequences:

- The server renders "no record yet" and a stopped clock. Both fill in immediately in the browser.
- The lint rule stays on, with no suppressions anywhere in the codebase.

## 2026-07-12: Playwright Targets localhost, Not 127.0.0.1

Decision: `playwright.config.ts` uses `http://localhost:3000`.

Reasoning:

- Next's dev server serves from `localhost` and treats a request originating at `127.0.0.1` as cross-origin, so it blocks its own client chunks.
- The page still renders, so this fails in a way that looks like an app bug rather than a config one: a frozen clock and buttons that do nothing, because the page never hydrates.
- The alternative, adding `allowedDevOrigins: ['127.0.0.1']` to `next.config.ts`, loosens the app's origin policy to satisfy a test. Pointing the test at the right origin is the smaller change.

Consequences:

- E2E exercises the same origin a developer uses.
- `next.config.ts` stays empty.

## 2026-07-12: Vitest Installs Its Own localStorage

Decision: `vitest.setup.ts` installs a minimal `localStorage` when the environment lacks one.

Reasoning:

- Node 26 ships an experimental `localStorage` global that stays inert unless the process is started with `--localstorage-file`. It shadows the implementation jsdom would otherwise install, so `window.localStorage` is undefined under Vitest.
- The app already survives that, because `createLocalJsonStorage` guards every call. But then the personal record tests would pass while proving nothing, since no value is ever stored.

Consequences:

- Record persistence is genuinely exercised in unit tests.
- Browsers never take this path. The shim is confined to the test setup file.

## 2026-07-12: One Validator Dispatcher, Keyed By Validation Spec

Decision: `validateChallenge` routes to a validator using `challenge.validation.kind`. Validators never see a challenge id.

Reasoning:

- `ARCHITECTURE.md` calls for a single dispatcher, but no file in the plan's Phase 2 list held one, so `src/domain/validation/validateChallenge.ts` was added.
- Branching on a challenge id would mean every new challenge needs a code change, and renaming or reversioning a challenge would silently break its validation.

Consequences:

- Phase 6 adds a challenge family by registering one validator against a new `ValidationSpec` kind.
- A challenge can be renamed or reversioned without touching validation code, which a test pins.

## 2026-07-12: Scaffold Next.js By Hand Instead Of Using create-next-app

Decision: Write `package.json`, `tsconfig.json`, `next.config.ts`, `postcss.config.mjs`, `eslint.config.mjs`, `vitest.config.ts`, and `playwright.config.ts` by hand rather than running `npm create next-app@latest .` as `IMPLEMENTATION_PLAN.md` suggested.

Reasoning:

- `create-next-app` refuses to scaffold into a directory containing files it does not recognize, and this directory already held ten planning docs.
- The plan already flagged the risk: "Scaffolding in a non-empty directory can overwrite docs if done carelessly."
- Hand-writing the config gives exactly the dependency set the plan calls for and zero chance of touching the docs.

Consequences:

- The scaffold carries no unused boilerplate: no demo page, no SVG assets, no default favicon.
- Config files must be maintained deliberately rather than inherited from a template.

## 2026-07-12: The Challenge Owns Its Grid Data; The Test Fixture Re-Exports It

Decision: `createRevenueGrid()` lives in `src/data/challenges/selectionRevenueColumn.ts`. `src/test/fixtures/revenueGrid.ts` re-exports it.

`ARCHITECTURE.md` and `IMPLEMENTATION_PLAN.md` placed the grid builder in `src/test/fixtures/revenueGrid.ts` while also giving the challenge an `initialGrid` built from it.

Reasoning:

- That arrangement makes production code import from the test tree, which pulls test files into the Next.js bundle and inverts the dependency direction.
- A challenge's dataset is part of the challenge, not a test artifact.

Consequences:

- Production code never imports from `src/test`.
- Tests still get the grid from the fixture path the plan named, so the plan's file list stays accurate.

## 2026-07-12: Challenge Identity Splits Into `id` And `version`

Decision: The first challenge is `id: "selection.revenue-column"` with `version: "v1"`.

`ARCHITECTURE.md` showed `id: "selection.revenue-column.v1"` with no version field. `IMPLEMENTATION_PLAN.md` later gave `Challenge` both an `id` and a `version`. The plan's type wins.

Reasoning:

- The planned leaderboard submission carries `challengeId` and `challengeVersion` as separate fields.
- Versioned validators need to compare a challenge's identity separately from its revision.

Consequences:

- A revalidating server can group runs by `id` and reject a stale `version`.
- The plan's `Challenge` type is used unchanged.

## 2026-07-12: Test And Lint Tooling Corrections

Decision: Depend on `@playwright/test` rather than `playwright`, and set `"lint": "eslint"` rather than `"lint": "next lint"`.

Reasoning:

- `@playwright/test` is the package that provides the `playwright test` runner the plan's `npm run e2e` script calls.
- `next lint` was removed in Next.js 16.

Consequences:

- `npm run e2e` and `npm run lint` behave as the plan intended on the current toolchain.
- A `typecheck` script (`tsc --noEmit`) was added alongside them, because the Next build does not typecheck test files.

## 2026-07-13: Build A Custom Simplified Grid First

Decision: Start with a custom simplified grid rather than embedding Microsoft Excel, integrating Google Sheets, or adopting a full spreadsheet SDK immediately.

Reasoning:

- The first playable build needs selection, validation, timing, retry, and local PRs more than full spreadsheet compatibility.
- A custom grid gives direct control over input latency, event handling, and visual polish.
- The architecture still defines a grid adapter so a richer grid engine can replace or augment the custom grid later.

Consequences:

- Early formula behavior will be limited.
- Early validation can be very deterministic.
- UI must feel spreadsheet-like enough for trust even if it is not a full clone.

## 2026-07-13: Use Local Personal Records Before Accounts

Decision: Store early personal records in `localStorage`.

Reasoning:

- Users must be able to play without signup.
- PR chasing is central to the emotional loop.
- Cloud accounts and leaderboards should wait until the core game is fun.

Consequences:

- PRs are device-local in early builds.
- Clearing browser storage removes records.
- The record model must be easy to migrate later.

## 2026-07-13: Delay Global Leaderboards And Anti-Cheat

Decision: Prepare leaderboard-compatible result shapes, but do not build full global leaderboards or anti-cheat in v1.

Reasoning:

- Leaderboards are only valuable if the core loop feels good.
- Fair validation needs more challenge coverage and replay/event decisions.
- Anti-cheat can become a product sinkhole too early.

Consequences:

- V1 focuses on local PRs.
- Result objects include challenge id, version, seed, score, time, correctness, completion percent, and accuracy.
- Future server validation remains possible.

## 2026-07-13: First Challenge Is "Select The Revenue Column"

Decision: The first playable challenge is selecting the Revenue column.

Reasoning:

- It exercises the spreadsheet grid, selection state, validation, timer, scoring, result card, retry, and PR loop.
- It is fast enough to judge whether the product has the desired "try again" feeling.
- It avoids formula complexity while still being a real spreadsheet action.

Consequences:

- Phase 1 and Phase 2 should optimize for selection fidelity.
- Other challenge families wait until this loop is verified.

