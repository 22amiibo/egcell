# Product Strategy

## Product Positioning

Excel Speed Trainer is a spreadsheet speed game. It should make a player think: "I want to try again and get a faster time."

The app borrows the engagement shape of Monkeytype: instant start, minimal UI, repeatable tests, clear performance feedback, personal records, and later leaderboards. It must not copy Monkeytype code or become a typing-test reskin.

## Product Boundaries

Build a fast spreadsheet-action game, not:

- An Excel course.
- An AI tutor.
- A business SaaS product.
- A school study app.
- A full spreadsheet clone.
- A Microsoft Excel or Google Sheets integration.
- A file conversion/import/export product.

The app can look different from Excel, but common interactions must feel close enough that players trust the skill transfer.

## Target V1 User

The first user is a desktop spreadsheet user who already understands basic spreadsheet concepts and wants to get faster. They should be able to play without signup, without onboarding friction, and without installing Excel.

Platform priority:

1. Desktop web.
2. Chrome.
3. Mac-first where platform tradeoffs matter.
4. Windows kept in mind for shortcuts and later leaderboards.

No mobile focus for v1.

## Core Loop

```text
challenge -> grid action -> validation -> time/score -> PR -> retry
```

Important loop rules:

- The player starts quickly.
- No hints during active main-speed runs.
- The player can recover from mistakes.
- The final state matters more than perfect route tracking in early builds.
- Result feedback is fast and compact.
- Retry is one obvious action.

## Game Modes

### Main Speed Mode

The default experience. Players complete short spreadsheet challenges as fast as possible.

Rules:

- No hints during active run.
- No skipping in score-counting sessions.
- Recoverable mistakes.
- Final correctness determines completion.
- Score combines elapsed time, correctness, completion percent, and accuracy.

### Practice Mode

Practice mode can explain faster routes after the run. It should not interrupt the run with hints.

Rules:

- Same challenge engine as main mode.
- Post-run shortcut suggestions allowed.
- No leaderboard scoring required.
- Local PRs may still be shown if useful.

### Leaderboard Mode

Leaderboards matter long-term, but they should wait until validation is fair and the core loop is fun.

Planned boards:

- Daily official challenge.
- Weekly board.
- Global board.
- Friend board.
- Later verified boards if anti-cheat and replay support justify them.

Do not split Mac/Windows or mouse/keyboard unless testing proves the advantage is unfair.

## Challenge Philosophy

Challenges are speed drills, not long puzzles.

- Most early challenges should take 5 to 20 seconds.
- Longer multi-step challenges should usually stay under 1 minute.
- Allow multiple valid methods when validation can support it.
- Formula challenges may initially require an obvious solution if broad formula equivalence is too expensive.
- AI may generate challenge data later, but validation must remain deterministic code.

## Initial Challenge Families

### Navigation

- Move to target cell.
- Jump to end of row or column.
- Find first blank cell.
- Move to edge of data region.

### Selection

- Select a column.
- Select a row.
- Select a table.
- Select a target range.
- Select only values.

### Formatting

- Format numbers as currency.
- Format percentages.
- Bold header row.
- Apply date format.
- Highlight target range.

### Sort And Filter

- Sort Revenue high to low.
- Sort Names A to Z.
- Filter Region to East.
- Filter Status to Complete.
- Show only rows above a threshold.

### Simple Formulas Later

- SUM.
- AVERAGE.
- Fill down.
- Simple relative references.
- More advanced formulas after the interaction loop is proven.

## Progression

Primary progression:

- Personal records.
- Faster times.
- Profiles later.
- Leaderboards later.
- Badges later.

Minimal XP is acceptable but not central. Do not build a streak system, daily quest grind, or complex achievements in v1.

## Result Card

Show simple results first:

- Time.
- Score.
- Correctness or accuracy.
- Personal record comparison.
- Retry action.

Put detailed metrics in a disclosure/dropdown:

- Completion percent.
- Mistake count.
- Accuracy inputs used by scoring.
- Challenge id and seed.
- Later percentile/rank.

## First Playable Build

The first playable build should prove the loop with one challenge:

> Select the Revenue column.

Acceptance for the product feel:

- The app opens directly into the game surface.
- It looks intentionally designed in dark mode.
- The grid feels responsive.
- Selecting the correct Revenue column completes the challenge.
- The result card appears immediately.
- Retry reseeds or resets the run without friction.
- A faster clean run feels worth chasing.

