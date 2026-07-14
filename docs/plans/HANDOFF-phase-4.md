# Handoff — Phases 4 and 5 are done; Phase 6 is next

The plan of record is `docs/plans/2026-07-13-hotkey-routes-and-history.md`. **Read §1a (the addenda)
before anything else** — every correction the user has made lives there, and §1a.12 is Phase 4's.

## Where things stand

| Commit | Phase |
|---|---|
| `92be098` | 1 — semantic command layer |
| `eb619f3` | 1 correction — Practice eligibility, `APPLY_BOLD` vs `TOGGLE_BOLD` |
| `d77266c` | 2 — complete keyboard command set (FilterMenu, `Alt+↓`, `TOGGLE_FILTER`, `mod+Shift+3`) |
| `0c116f2` | 2 — keyboard-solve coverage for the eight classics |
| `b7f6bc1` | 3 — run log, `getRunEligibility`, v1 migration |
| `58d0866` | **4 — the BFS route solver, the registry, the cache** |
| `614328f` | **5 — the post-run fastest-path card and route comparison** |

Validated at `614328f`: typecheck clean, lint clean, build clean, **787/787 unit**, **44/44 e2e**.

Phases remaining: **6, 7, 8, 9, 10.**

## What Phase 4 turned up (all of it is written up in §1a.12)

- **The solver found a live scoring exploit.** `validateFormatting` only ever inspected the cells
  *inside* the required range, so "make the Name values bold" was solvable by selecting the whole
  table and pressing Ctrl+B — two actions, fewer than doing it properly, and it graded as a pass.
  The user chose to close it in the engine: formatting that spills outside the columns or rows the
  target range touches no longer counts. **This changed grading**, deliberately.
- **§6.3's central assumption was wrong.** "Navigate to a cell holding West, then filter" does *not*
  fall out of the search for free — a difficulty-5 table is twenty-plus rows tall and `maxDepth: 8`
  cannot cross it. Budgets are now 32 / 1,000,000, and three optimality-preserving prunes make that
  affordable. The subtlest: never prune navigation out of a range selection **at the root**, because
  a composite's later part *starts* holding one, and pruning there told the solver a player who had
  just bolded a row could never move again.
- **The solver was searching actions the game refuses** (`challenge.allowedActions`) — a correctness
  bug, not merely a slow search.

## Phase 6 — what to build

**Objective:** reveal the fastest path mid-run, at the cost of the run's ranking.

New: `hooks/useAssist.ts`, `components/game/{HelpPanel,UnrankedBadge}.tsx`.
Changed: `ChallengeRun.tsx`, `SessionRun.tsx`, `useGameRun.ts`, `ResultCard.tsx`, `themes.ts` +
`SettingsPanel.tsx` (the `help` category).

What Phase 5 already built that Phase 6 should reuse rather than rebuild:

- `useFastestPath(challenge, events, enabled)` — **`enabled` is the latency guarantee.** The help
  panel passes `true` only once help has been revealed, which has already unranked the run, so the
  solve may cost what it costs. A test pins that the solver never runs while `enabled` is false.
- `FastestPathCard` — §7.2 says the help panel is "the post-run card minus the comparison rows", so
  it reuses this component instead of growing a second one.
- `getRunEligibility` already unranks an `assist: "revealed"` run. **Phase 6 task 5 is explicit: the
  PB path must be skipped by the policy, not by a new inline check.** `useGameRun` currently
  hardcodes `assist: "none"` at the call site — that is the line to thread the real state through.

Watch for: revealing help during a *session* assists the whole session (no session record), and the
confirmation exists precisely because an accidental click would otherwise destroy a PB attempt with
no undo.

## Standing instructions — do not lose these

- **Reconcile the plan before implementing.** Every deviation goes into a §1a addendum with its
  reasoning. The user has caught real errors this way more than once.
- **Practice is an ordinary record-eligible mode.** Assistance — never mode identity — is what
  unranks a run. `getRunEligibility` cannot see `modeKey`, deliberately. (§1a.1, §1a.4.)
- **A command id must match the operation it performs.** `APPLY_BOLD` (toolbar, always sets bold on)
  is a different command from `TOGGLE_BOLD` (keyboard, can unbold). (§1a.9.)
- Git: stage files **by name**, never `git add -A`. New commits, not amends. Leave the untracked
  `src/app/games/` directory alone — it is an unrelated design doc.
- The user asked to "run as many phases as you can", so keep going unless told otherwise.

## Things worth knowing that cost time

- A pre-tool-use "Fact-Forcing Gate" hook blocks the first Write/Edit of every file and the first
  Bash call. State the four facts (callers, no-duplicate-purpose, data schema, the user's verbatim
  instruction) in chat, then retry the identical call — it then succeeds.
- **Do not write a wall-clock performance test.** One was tried and removed: timings swing by 2× with
  suite parallelism, and a loop over every variant blows Vitest's 5-second per-test timeout. The real
  blowup guard is that an exploded search exhausts its node budget and returns `null`, which the
  "every shipped variant yields a route" tests already catch, deterministically.
- `.next/` can hold stale duplicate `.d.ts` files that break `tsc`. Deleting the directory fixes it —
  but it also kills a running `next dev`, and Playwright then fails to reuse the server.
