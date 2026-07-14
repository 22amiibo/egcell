# Handoff — the plan is complete (Phases 0–10)

The plan of record is `docs/plans/2026-07-13-hotkey-routes-and-history.md`. **Read §1a (the addenda)
first** — every correction and every deviation lives there, with its reasoning.

## Where things stand

| Commit | Phase |
|---|---|
| `92be098` | 1 — semantic command layer |
| `eb619f3` | 1 correction — Practice eligibility, `APPLY_BOLD` vs `TOGGLE_BOLD` |
| `d77266c` `0c116f2` | 2 — complete keyboard command set |
| `b7f6bc1` | 3 — run log, `getRunEligibility`, v1 migration |
| `58d0866` | 4 — the BFS route solver, registry, cache |
| `614328f` | 5 — post-run fastest-path card and route comparison |
| `167f508` | 6 — help control and assisted runs |
| `7144106` | 7 — Hotkey Mode |
| `bc73009` | 8 — Recent Runs |
| `94445ee` | 9 — the performance graph |
| (this one) | 10 — scale, retention, docs |

Validated at HEAD: typecheck clean, lint clean, build clean, **839/839 unit**, **46/46 e2e**.

## The one thing still owed

**`run-history:v1` is deliberately still on disk.** §11's Phase 10 task 4 says retire it "only now, one
release *after* the log shipped" — and the log shipped in Phase 3 of this same release. Deleting the
backup in the release that introduced the migration would remove the safety net exactly when a
migration bug is still undiscovered. It is written up in §1a.15 and in `DECISIONS.md`. **The next
release should delete the key**, and `readRunLog` needs no change when it does: the presence of the
log key is already the "already migrated" flag.

## What the solver found that nobody was looking for

- **A live scoring exploit.** "Make the Name values bold" was solvable by selecting the whole table
  and pressing Ctrl+B — two actions, fewer than doing it properly, and it graded as a pass. Closed in
  `validateFormatting` (the user chose this over hiding it in the card). **This changed grading.**
- **The toolbar was lying about who pressed it** — every activation recorded as `"pointer"`, including
  Tab-and-Enter. Inert until Hotkey Mode existed, at which point it would have cost keyboard-only
  players the records they earned.
- **`selectEligibleForStats` never enforced the Hotkey category's `keyboardPure`**, though the comment
  claimed it did.
- **The solver was searching actions the game refuses** (`allowedActions`) — a correctness bug found
  while chasing a budget.

## Standing instructions

- **Reconcile the plan before implementing.** Every deviation goes in a §1a addendum with reasoning.
- **Practice is an ordinary record-eligible mode.** Assistance — never mode identity — unranks a run.
  `getRunEligibility` cannot see `modeKey`, deliberately.
- **A command id must match the operation it performs** (`APPLY_BOLD` ≠ `TOGGLE_BOLD`).
- Git: stage files **by name**, never `git add -A`. New commits, not amends. Leave the untracked
  `src/app/games/` directory alone — it is an unrelated design doc.

## Things worth knowing that cost time

- A pre-tool-use "Fact-Forcing Gate" hook blocks the first Write/Edit of every file and the first Bash
  call. State the four facts (callers, no-duplicate-purpose, data schema, the user's verbatim
  instruction) in chat, then retry the identical call.
- **Do not write a wall-clock performance test.** One was tried and removed: timings swing 2× with
  suite parallelism, and a loop over every variant blows Vitest's 5s per-test timeout. A search that
  explodes exhausts its node budget and returns `null`, which the "every variant yields a route" tests
  already catch deterministically.
- A test that means a mouse click must say `fireEvent.click(el, { detail: 1 })`. `element.click()` is
  `detail: 0`, which is exactly what a keyboard activation looks like — and is now read as one.
- `.next/` can hold stale duplicate `.d.ts` files that break `tsc`. Deleting it fixes that, but it
  also kills a running `next dev`, and Playwright then fails to reuse the server.
