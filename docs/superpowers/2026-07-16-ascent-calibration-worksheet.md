# Ascent Calibration Worksheet (Phase 6)

**Status:** readiness audit complete; the tuning itself is blocked on playtest data (intrinsic to the phase).
**Context:** branch `feat/ascent` @ `cd88cb0`, Phases 0–5 complete and gated. Phase 6 = "Calibrate" = the deferred `IMPLEMENTATION_PLAN.md` Phase I tuning pass, now with the ladder in place.

Phase 6 changes **no systems** — it re-picks constants against observed play. The decisions are conditional on real human play data and cannot be fabricated. This worksheet makes the protocol runnable and records what was verified.

---

## 1. Tunables — verified locations and current values

Every knob audited at `cd88cb0`; each is single-sourced (a tuning change lands in exactly one place).

| Constant | Home (file:line) | Current value | Plan-table value | Match |
|---|---|---|---|---|
| `COMBO_CAP` / `COMBO_STEP` | `src/domain/scoring/combo.ts:14-15` | 5 / 0.1 | 5 / 0.1 | ✓ |
| `MAX_COMBO_MULTIPLIER` | `src/domain/scoring/scoreRun.ts:9` | 1.5 | 1.5 | ✓ |
| `SPEED_DIFFICULTY_MIX` | `src/data/challenges/queue.ts:22` | `[2,1,3,2,2,4,2,3,1,2]` | same | ✓ |
| `heatToPromote` / `durationSeconds` | `src/domain/ascent/ascentTypes.ts:10` (`ASCENT_CONFIG`) | 3 / 90 | 3 / 90 | ✓ |
| `TIER_WEIGHT_STEP` / `OVERDRIVE_TIGHTENING` | `src/domain/ascent/ascentScore.ts:4-5` | 0.25 / 0.9 | 0.25 / 0.9 | ✓ |
| `scaledSeconds` / `scaledPoints` | `src/domain/challenges/templates/shared.ts:19-25` | `base+(d−1)` / `base+(d−1)·150` | +1s / +150pts per difficulty | ✓ |
| formula template targets | `src/domain/challenges/templates/formula.ts` (`baseSeconds`/`basePoints` per template, scaled by `scaledSeconds`/`scaledPoints`) | 8–10s / 400–500pts base | 8–10s / 400–500pts | ✓ |
| **`COMMAND_MASTERY_THRESHOLDS`** | `src/domain/mastery/commandMastery.ts:65` | 15/40/80, 2500/1200ms | listed as `MASTERY_THRESHOLDS` | ✓ (**renamed** in Phase 5 to de-collide with the shipped `masteryTypes.MasteryLevel`) |

Also single-sourced next to the ascent knobs: `maxTier: 5` (`ASCENT_CONFIG`), `MIN_TARGET_SECONDS` floor for overdrive (`ascentScore.ts`).

---

## 2. The instrument — what the run log can and cannot measure

Export: DevTools → Application → Local Storage → copy `excel-speed-trainer:v1:run-log`. The
`runs[]` array is the per-run history; the fields below live directly on each entry. To read the
combo signal specifically: filter `runs[]` to `modeKey:"ascent"` and `modeKey` starting with
`sprint-`/session modes (single/practice/hotkey rows carry `peakComboStreak`/`comboBreakCount`/
`comboOpportunityCount` as `null` — skip them), then sum `comboBreakCount` and
`comboOpportunityCount` separately across whatever survives before dividing (§ formula below) —
never average each run's own rate.

| Protocol check | Signal needed | In the log? | How to compute |
|---|---|---|---|
| Median peak tier (target **3–4** for a practiced player) | per-Ascent-run peak tier | **✓** | `RunRecord.peakTier` over records with `modeKey:"ascent"`; take the median |
| New-record rate (**~15–30%** after the first five) | which runs set a PR | **✓** (indirect) | `RunRecord.isNewRecord` share of `modeKey:"ascent"` runs, skipping the first 5 |
| Formula solve times vs targets | per-drill elapsed vs target | **✓ (single runs only)** | filter `family:"formulas"`, `modeKey` main-speed/practice; compare `elapsedMs` vs `targetMs`. **Not** available per-task inside an Ascent climb (Ascent logs the aggregate: `targetMs:null`, `elapsedMs`=90 000) |
| Combo streaks "break sometimes on honest players" | combo break frequency | **✓** (Task 6.0) | `comboBreakRate(metrics)` — see below. Pooled across runs; a single run's rate is noisy (§ minimum sample) |

**The gap is closed.** `RunRecord` now carries three additive, nullable fields — `peakComboStreak`, `comboBreakCount`, `comboOpportunityCount` — folded once per run by `foldComboRunMetrics` (`src/domain/scoring/comboRunMetrics.ts`) from the exact `ComboTaskOutcome`s each `SessionRun`/`AscentRun` fed to `advanceCombo`. Additive and normalized-on-read, exactly like the Phase-4 `peakTier`/`wpm`/`keystrokeAccuracy` fields: no migration, `RUN_RECORD_VERSION` stays 2, the storage key is unchanged. Single/practice/hotkey runs (`runRecordForChallenge`) still carry all three as `null` — the combo economy does not apply to them at all (`combo.ts`'s own docstring).

**The formula, read off the export:**

```
comboBreakRate = comboOpportunityCount > 0 ? comboBreakCount / comboOpportunityCount : null
```

- `comboOpportunityCount` counts only the transitions that entered **with an active combo** (`streak > 0`) — the moments a break was actually possible. A task that starts a combo, or stays dead, is not an opportunity.
- The rate is **`null`, not `0`**, for any run whose `comboOpportunityCount` is `0` (or is itself `null` — a historical row from before Task 6.0). Skip null-opportunity rows when pooling; averaging them in as zero would read "never had a combo" as "never broke one," which is a different, false claim.
- `peakComboStreak` is **raw and unbounded** — it is never clamped to `COMBO_CAP` (5). It is descriptive (how far this run's best streak reached) and **must not substitute for break rate**: a run can post a high peak and still break constantly once a combo is live, or never build one at all.

**Minimum sample size:** a single run's `comboBreakRate` is noisy — a run with 2–3 opportunities can only read 0%, 50%, or 100%. Pool `comboBreakCount`/`comboOpportunityCount` **across every eligible run first**, then divide once, and treat the pooled rate as unread until it rests on **at least ~20 total opportunities** (the same order-of-magnitude floor as the ≥20-run play-data ask in §4). Below that floor, note the rate as provisional rather than acting on it.

---

## 3. Data-free sanity anchors (derivable from the constants alone)

Reaching a tier costs `heatToPromote` (3) under-target clears; the clock is 90s.

- **Tier 5 (4 promotions) = 12 under-target clears in 90s → ≤ 7.5s per clear, flawless** (no over-target clear, which resets heat). Any real run needs to be faster, since some clears will miss target.
- **Target band (median peak 3–4) ≈ 6–9 under-target clears → ~10–15s per effective clear.**
- Reading the shape:
  - practiced players hitting **tier 5 almost every run** → tasks too fast/easy for the clock → **raise `heatToPromote`** (3→4) or **tighten `scaledSeconds`**.
  - stuck at **tier 2** → the opposite (lower `heatToPromote`, or loosen `scaledSeconds`).
  - These are the levers the protocol names; the anchors above say roughly how far a one-step change moves the median.

---

## 4. Protocol (operationalized checklist)

- [ ] Collect: ≥20 Ascent runs and ≥10 sessions, across two people / skill levels. Export the run log after.
- [ ] **Shape:** compute median `peakTier` (ascent runs). In 3–4 band? If not, adjust `heatToPromote` / `scaledSeconds` per §3.
- [ ] **Records:** `isNewRecord` share (ascent, after first 5) in ~15–30%? If far off, revisit `TIER_WEIGHT_STEP` and the scoring scale.
- [ ] **Combo:** pool `comboBreakCount`/`comboOpportunityCount` across all eligible runs (§2 formula); read `comboBreakRate` only once pooled opportunities reach ≥ ~20. Never breaks → route-waste too lenient; breaks constantly → reconsider counting one correction as dirty (`comboOutcomeFrom`). `peakComboStreak` is descriptive only — do not read it in place of the rate.
- [ ] **Formula pace:** single formula runs — `elapsedMs` vs `targetMs`. Consistently way under/over → adjust the template `baseSeconds` in `formula.ts`.
- [ ] Pin every adjusted constant's new value **in its test**, and record the reasoning in `DECISIONS.md`.
- [ ] Commit: `chore(balance): calibration pass over the ladder, combo, and typing targets`.

---

## 5. What's needed to finish Phase 6

1. **Play data** — the run-log export described in §2/§4. Without it the tuning decisions are fabrication.
2. ~~A decision on the combo instrument gap (§2)~~ — **closed** (Task 6.0): `peakComboStreak`, `comboBreakCount`, `comboOpportunityCount` now ride on every Session/Ascent `RunRecord`, additive and normalized-on-read. Nothing further blocks combo from the export; playtest data alone remains.
3. Alternatively, if you already have a feel for a specific imbalance ("tier 5 every run", "combo never breaks"), name it and the single constant change + test pin + `DECISIONS.md` note can be made directly.
