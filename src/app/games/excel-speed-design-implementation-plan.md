# Excel Speed Design Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the design inspiration report into an original, Monkeytype-inspired but non-copying design system for the Excel speed practice game.

**Architecture:** Keep the spreadsheet grid as the main stage and build the experience through semantic design tokens, focused game components, richer settings, and post-run feedback loops. Preserve the existing domain/UI split: pure game and scoring logic remains in `src/domain`, React components remain in `src/components`, and routes remain in `src/app`.

**Tech Stack:** Next.js App Router, React, TypeScript, Tailwind CSS v4, CSS custom properties, local storage, Vitest, Testing Library, Playwright.

## Global Constraints

- Do not copy Monkeytype code, theme names, palettes, text, assets, sounds, layouts, or implementation details.
- Use Monkeytype only as inspiration for principles: minimalism, speed, keyboard-first flow, customization, instant feedback, competitive loops, and replayability.
- The app must feel spreadsheet-native and purpose-built for Excel-speed practice, not like a generic SaaS dashboard.
- The practice screen is the priority surface; the grid must remain visually dominant.
- Ranked/scored runs must stay low-clutter. Put hints, teaching copy, and detailed analysis in practice mode or results.
- Mouse actions may be allowed by mode, but keyboard fluency must be rewarded.
- Respect reduced motion and high-contrast accessibility settings.
- Do not overwrite unrelated user work. Before implementation, inspect `git status --short`; current known user/workspace changes include `src/domain/queue/`, `src/data/challenges/queue.ts`, `src/domain/sessions/sessionRecords.ts`, and `src/hooks/useLocalSessionRecords.ts`.

---

## File Map

### Create

- `src/components/game/LiveStatsBar.tsx` - compact live EPM, accuracy, shortcut efficiency, progress, and pace display.
- `src/components/game/TaskProgressRail.tsx` - fixed-size session progress indicator.
- `src/components/game/ComboIndicator.tsx` - quiet streak/combo display with reduced-motion support.
- `src/components/game/RunFeedbackLayer.tsx` - non-layout-shifting success, error, shortcut, and PB pace feedback.
- `src/components/game/ShortcutFlash.tsx` - tiny key glyph display for detected shortcut actions.
- `src/components/settings/settingsSchema.ts` - UI-facing settings categories and control metadata.
- `src/components/settings/SettingControl.tsx` - reusable setting row/control renderer.
- `src/components/leaderboard/LeaderboardShell.tsx` - local/mock leaderboard layout shell.
- `src/components/profile/MasteryPanel.tsx` - skill mastery/progression surface.
- `src/domain/stats/liveRunStats.ts` - pure live stat calculations from run events and challenge state.
- `src/domain/mastery/masteryTypes.ts` - skill families, mastery levels, unlock metadata.
- `src/domain/mastery/calculateMastery.ts` - pure mastery projection from local run history.
- `src/lib/sound/runSounds.ts` - sound preference model and event-to-sound mapping, initially silent/off-safe.

### Modify

- `src/app/globals.css` - expand semantic CSS custom properties and animation tokens.
- `src/domain/settings/themes.ts` - replace theme-only settings with broader settings and original theme concepts.
- `src/hooks/useSettings.ts` - read/write expanded settings with migration from existing theme-only data.
- `src/components/settings/ThemeApplier.tsx` - apply new semantic tokens and motion preferences.
- `src/components/settings/SettingsPanel.tsx` - category-based settings UI.
- `src/components/game/GameShell.tsx` - reduce dashboard feel, add launch-console hierarchy, pass settings into runs.
- `src/components/game/ChallengeRun.tsx` - add live stats, progress, feedback layer, compact practice frame.
- `src/components/game/SessionRun.tsx` - add same live stats/progress pattern for multi-task modes.
- `src/components/game/ResultCard.tsx` - upgrade one-run results with EPM, PB delta, shortcut efficiency, weak-skill hint.
- `src/components/game/SessionResultCard.tsx` - upgrade session results with task breakdown and replay drivers.
- `src/components/grid/gridMetrics.ts` - connect cell dimensions to density settings without causing layout shift mid-run.
- `src/components/grid/SpreadsheetGrid.tsx` - expose optional feedback hooks and density props while keeping keyboard behavior intact.
- `src/components/profile/ProfilePanel.tsx` - add mastery/progression sections above recent runs.

---

## Public Interfaces To Establish

```ts
export type GridDensity = "compact" | "comfortable" | "large";
export type MousePolicy = "allowed" | "penalized" | "disabled";
export type HotkeyStrictness = "encouraged" | "strict" | "ranked";
export type PromptPosition = "top" | "left" | "bottom";

export type ExpandedSettings = {
  appearance: {
    themeId: string;
    accentMode: "steady" | "pace" | "combo";
    fontFamily: "system" | "mono" | "dyslexia";
    reducedChrome: boolean;
  };
  grid: {
    density: GridDensity;
    showFormulaBar: boolean;
    showHeaders: boolean;
    gridlineStrength: "soft" | "standard" | "strong";
    promptPosition: PromptPosition;
  };
  gameplay: {
    instantRestart: boolean;
    defaultMode: "single" | "practice" | "sprint5" | "sprint10" | "timed30" | "timed60";
    skipBehavior: "practiceOnly" | "allowed" | "disabled";
  };
  scoring: {
    mousePolicy: MousePolicy;
    hotkeyStrictness: HotkeyStrictness;
    mistakePenalty: "light" | "standard" | "strict";
  };
  feedback: {
    liveStats: boolean;
    combo: boolean;
    shortcutFlash: boolean;
    mistakeStyle: "subtle" | "clear" | "minimal";
  };
  sound: {
    enabled: boolean;
    volume: number;
    movement: boolean;
    success: boolean;
    error: boolean;
    combo: boolean;
    runComplete: boolean;
  };
  accessibility: {
    reducedMotion: boolean;
    highContrast: boolean;
    largeTargets: boolean;
  };
  privacy: {
    leaderboardOptIn: boolean;
    anonymousName: string;
    rankedMode: boolean;
  };
};
```

```ts
export type LiveRunStats = {
  elapsedMs: number;
  epm: number;
  accuracy: number;
  shortcutEfficiency: number;
  combo: number;
  mistakes: number;
  completedTasks: number;
  totalTasks: number;
  pbDeltaMs: number | null;
};
```

---

## Task 1: Expand Semantic Design Tokens

**Files:**
- Modify: `src/app/globals.css`
- Modify: `src/domain/settings/themes.ts`
- Test: `src/domain/settings/themes.test.ts`

**Interfaces:**
- Consumes: existing `ThemeTokens`, `THEME_PRESETS`, `applyThemeToRoot`.
- Produces: semantic token names for grid, feedback, motion, focus, and typography.

- [ ] **Step 1: Add a failing test for complete theme tokens**

```ts
import { THEME_PRESETS } from "@/domain/settings/themes";

test("all theme presets provide complete semantic tokens", () => {
  for (const preset of THEME_PRESETS) {
    expect(preset.tokens.background).toBeTruthy();
    expect(preset.tokens.surface).toBeTruthy();
    expect(preset.tokens.surfaceElevated).toBeTruthy();
    expect(preset.tokens.gridLine).toBeTruthy();
    expect(preset.tokens.gridLineStrong).toBeTruthy();
    expect(preset.tokens.activeCell).toBeTruthy();
    expect(preset.tokens.selectedRange).toBeTruthy();
    expect(preset.tokens.correct).toBeTruthy();
    expect(preset.tokens.warning).toBeTruthy();
    expect(preset.tokens.error).toBeTruthy();
    expect(preset.tokens.accent).toBeTruthy();
    expect(preset.tokens.textPrimary).toBeTruthy();
    expect(preset.tokens.textMuted).toBeTruthy();
  }
});
```

- [ ] **Step 2: Run the test and verify it fails**

Run: `npm test -- src/domain/settings/themes.test.ts`

Expected: fail because the current theme model does not expose every semantic token.

- [ ] **Step 3: Extend theme token types**

Add semantic tokens for:

```ts
background;
surface;
surfaceElevated;
gridLine;
gridLineStrong;
activeCell;
selectedRange;
correct;
warning;
error;
accent;
accentStrong;
textPrimary;
textMuted;
focusRing;
shadow;
```

- [ ] **Step 4: Rename public-facing theme concepts to original spreadsheet arena names**

Use original concepts such as `Ledger Noir`, `Quarter Close`, `OLED Ledger`, `Study Light`, `Arcade Pivot`, `Audit Trail`, `Graphite Desk`, `Market Open`, `Paper Grid`, `Cyber Range`, `Retro Cubicle`, `Calm Formula`, and `Prism Sheet`.

- [ ] **Step 5: Update CSS custom properties**

Map the new tokens into `globals.css` without removing compatibility vars until components are migrated.

- [ ] **Step 6: Run tests**

Run: `npm test -- src/domain/settings/themes.test.ts`

Expected: pass.

---

## Task 2: Build Expanded Settings Model

**Files:**
- Create: `src/components/settings/settingsSchema.ts`
- Modify: `src/domain/settings/themes.ts`
- Modify: `src/hooks/useSettings.ts`
- Test: `src/domain/settings/settings.test.ts`

**Interfaces:**
- Consumes: existing local storage key and theme-only settings.
- Produces: `ExpandedSettings`, `DEFAULT_SETTINGS`, `readSettings`, `writeSettings`, and migration from `{ themeId }`.

- [ ] **Step 1: Add migration tests**

```ts
import { coerceSettings, DEFAULT_SETTINGS } from "@/domain/settings/themes";

test("migrates legacy theme-only settings", () => {
  const settings = coerceSettings({ themeId: "excel-dark" });
  expect(settings.appearance.themeId).toBeTruthy();
  expect(settings.grid.density).toBe(DEFAULT_SETTINGS.grid.density);
});

test("falls back when settings are malformed", () => {
  expect(coerceSettings(null)).toEqual(DEFAULT_SETTINGS);
  expect(coerceSettings({ sound: { volume: "loud" } })).toEqual(DEFAULT_SETTINGS);
});
```

- [ ] **Step 2: Run test and verify it fails**

Run: `npm test -- src/domain/settings/settings.test.ts`

Expected: fail because `coerceSettings` and `DEFAULT_SETTINGS` do not exist yet.

- [ ] **Step 3: Implement expanded settings**

Add the `ExpandedSettings` interface from this plan and a conservative default where sound is off, live stats are on, reduced motion follows user preference, mouse is allowed, and hotkeys are encouraged.

- [ ] **Step 4: Add category schema**

`settingsSchema.ts` should export categories in this order:

```ts
Appearance;
Grid;
Gameplay;
Scoring;
Sound;
Feedback;
Accessibility;
Practice modes;
Leaderboard/privacy;
```

- [ ] **Step 5: Run tests**

Run: `npm test -- src/domain/settings/settings.test.ts`

Expected: pass.

---

## Task 3: Redesign Settings UI As A Tuning Surface

**Files:**
- Create: `src/components/settings/SettingControl.tsx`
- Modify: `src/components/settings/SettingsPanel.tsx`
- Modify: `src/components/settings/ThemeApplier.tsx`
- Test: `src/components/settings/SettingsPanel.test.tsx`

**Interfaces:**
- Consumes: `settingsSchema`, `ExpandedSettings`, `useSettings`.
- Produces: category navigation, keyboard-friendly controls, original theme cards.

- [ ] **Step 1: Write UI tests**

```tsx
render(<SettingsPanel />);
expect(screen.getByRole("heading", { name: /settings/i })).toBeInTheDocument();
expect(screen.getByRole("tab", { name: /appearance/i })).toBeInTheDocument();
expect(screen.getByRole("tab", { name: /grid/i })).toBeInTheDocument();
expect(screen.getByLabelText(/grid density/i)).toBeInTheDocument();
expect(screen.getByLabelText(/mouse policy/i)).toBeInTheDocument();
```

- [ ] **Step 2: Run test and verify it fails**

Run: `npm test -- src/components/settings/SettingsPanel.test.tsx`

Expected: fail because settings categories do not exist yet.

- [ ] **Step 3: Implement `SettingControl`**

Support segmented controls, toggles, sliders, and select controls. Keep labels concise and avoid tutorial copy.

- [ ] **Step 4: Rebuild `SettingsPanel`**

Use a two-column desktop layout with category rail and focused control panel. On narrow screens, use horizontal tabs.

- [ ] **Step 5: Update `ThemeApplier`**

Apply theme tokens, reduced motion, high contrast, font family, and grid density custom properties to `document.documentElement`.

- [ ] **Step 6: Run tests**

Run: `npm test -- src/components/settings/SettingsPanel.test.tsx`

Expected: pass.

---

## Task 4: Add Live Run Stats

**Files:**
- Create: `src/domain/stats/liveRunStats.ts`
- Create: `src/components/game/LiveStatsBar.tsx`
- Modify: `src/hooks/useGameRun.ts` only if existing state does not expose enough data
- Modify: `src/components/game/ChallengeRun.tsx`
- Modify: `src/components/game/SessionRun.tsx`
- Test: `src/domain/stats/liveRunStats.test.ts`

**Interfaces:**
- Consumes: `RunEvent[]`, elapsed time, task counts, validation state, personal record.
- Produces: `LiveRunStats`.

- [ ] **Step 1: Write stat calculation tests**

```ts
expect(calculateLiveRunStats({
  elapsedMs: 30_000,
  actions: 25,
  shortcutActions: 20,
  mistakes: 2,
  completedTasks: 10,
  totalTasks: 10,
  pbMs: 32_000,
})).toMatchObject({
  epm: 20,
  shortcutEfficiency: 80,
  completedTasks: 10,
  totalTasks: 10,
  pbDeltaMs: -2_000,
});
```

- [ ] **Step 2: Run test and verify it fails**

Run: `npm test -- src/domain/stats/liveRunStats.test.ts`

Expected: fail because stat calculation does not exist.

- [ ] **Step 3: Implement pure stats**

Calculate EPM as completed tasks per minute for sessions and equivalent action/task completion rate for single runs. Calculate shortcut efficiency from keyboard-like actions divided by all meaningful actions.

- [ ] **Step 4: Implement `LiveStatsBar`**

Display `EPM`, `accuracy`, `shortcut efficiency`, and `progress` in fixed-width stat cells so values do not shift layout.

- [ ] **Step 5: Mount in run screens**

Place `LiveStatsBar` near the prompt/timer rail. Do not put it inside the grid.

- [ ] **Step 6: Run tests**

Run: `npm test -- src/domain/stats/liveRunStats.test.ts`

Expected: pass.

---

## Task 5: Create The Practice Screen Frame

**Files:**
- Create: `src/components/game/TaskProgressRail.tsx`
- Modify: `src/components/game/ChallengeRun.tsx`
- Modify: `src/components/game/SessionRun.tsx`
- Modify: `src/components/game/ChallengePrompt.tsx`
- Test: `src/components/game/ChallengeRun.test.tsx`

**Interfaces:**
- Consumes: challenge prompt, timer, live stats, toolbar, grid, result overlay.
- Produces: fixed practice frame where the grid remains dominant.

- [ ] **Step 1: Add render test**

```tsx
render(<ChallengeRun challenge={challenge} personalRecord={null} onRecord={vi.fn()} />);
expect(screen.getByTestId("practice-frame")).toBeInTheDocument();
expect(screen.getByTestId("spreadsheet-grid")).toBeInTheDocument();
expect(screen.getByTestId("live-stats-bar")).toBeInTheDocument();
```

- [ ] **Step 2: Run test and verify it fails**

Run: `npm test -- src/components/game/ChallengeRun.test.tsx`

Expected: fail until test ids and frame exist.

- [ ] **Step 3: Implement fixed hierarchy**

Use:

1. top prompt rail
2. live stats rail
3. central grid
4. compact contextual toolbar
5. result overlay only after completion

- [ ] **Step 4: Verify no layout shift**

Ensure timer/stat values use tabular numerals and fixed min widths.

- [ ] **Step 5: Run test**

Run: `npm test -- src/components/game/ChallengeRun.test.tsx`

Expected: pass.

---

## Task 6: Add Feedback And Combo Layer

**Files:**
- Create: `src/components/game/RunFeedbackLayer.tsx`
- Create: `src/components/game/ComboIndicator.tsx`
- Create: `src/components/game/ShortcutFlash.tsx`
- Modify: `src/components/game/ChallengeRun.tsx`
- Modify: `src/components/game/SessionRun.tsx`
- Modify: `src/components/grid/SpreadsheetGrid.tsx`
- Test: `src/components/game/RunFeedbackLayer.test.tsx`

**Interfaces:**
- Consumes: run events, validation transitions, settings feedback preferences.
- Produces: visual feedback that never changes grid dimensions.

- [ ] **Step 1: Add tests for reduced motion**

```tsx
render(<RunFeedbackLayer event="success" reducedMotion />);
expect(screen.getByTestId("run-feedback-layer")).toHaveAttribute("data-motion", "reduced");
```

- [ ] **Step 2: Run test and verify it fails**

Run: `npm test -- src/components/game/RunFeedbackLayer.test.tsx`

Expected: fail until component exists.

- [ ] **Step 3: Implement feedback states**

Support `taskAppear`, `success`, `mistake`, `shortcut`, `combo`, `pbPace`, and `runFinished`.

- [ ] **Step 4: Keep animation fast**

Use CSS custom duration tokens:

```css
--motion-fast;
--motion-standard;
--motion-slow;
```

All practice-screen feedback should complete under `180ms` except result overlay entrance.

- [ ] **Step 5: Run test**

Run: `npm test -- src/components/game/RunFeedbackLayer.test.tsx`

Expected: pass.

---

## Task 7: Add Original Sound Hooks

**Files:**
- Create: `src/lib/sound/runSounds.ts`
- Modify: `src/components/game/ChallengeRun.tsx`
- Modify: `src/components/game/SessionRun.tsx`
- Modify: `src/components/settings/SettingsPanel.tsx`
- Test: `src/lib/sound/runSounds.test.ts`

**Interfaces:**
- Consumes: feedback events and sound settings.
- Produces: a sound event mapping with no bundled copied audio files.

- [ ] **Step 1: Add pure mapping tests**

```ts
expect(getSoundCue("success", { enabled: false })).toBeNull();
expect(getSoundCue("success", { enabled: true, success: true, volume: 0.4 })).toMatchObject({
  kind: "success",
  volume: 0.4,
});
```

- [ ] **Step 2: Run test and verify it fails**

Run: `npm test -- src/lib/sound/runSounds.test.ts`

Expected: fail until sound mapping exists.

- [ ] **Step 3: Implement silent-by-default sound model**

Define categories: movement, success, soft error, combo increase, PB pace, run complete, ranked promotion, daily challenge complete.

- [ ] **Step 4: Add settings controls**

Add master volume plus individual toggles. Do not include any copied sound assets.

- [ ] **Step 5: Run test**

Run: `npm test -- src/lib/sound/runSounds.test.ts`

Expected: pass.

---

## Task 8: Upgrade Results For Replay Motivation

**Files:**
- Modify: `src/components/game/ResultCard.tsx`
- Modify: `src/components/game/SessionResultCard.tsx`
- Modify: `src/domain/scoring/scoreRun.ts` only if extra score fields are needed
- Test: `src/components/game/ResultCard.test.tsx`

**Interfaces:**
- Consumes: `RunResult`, `LiveRunStats`, personal record state.
- Produces: EPM, accuracy, shortcut efficiency, PB delta, average task time, fastest task, slowest skill, and recommended retry.

- [ ] **Step 1: Write result display tests**

```tsx
expect(screen.getByText(/epm/i)).toBeInTheDocument();
expect(screen.getByText(/shortcut efficiency/i)).toBeInTheDocument();
expect(screen.getByText(/pb/i)).toBeInTheDocument();
expect(screen.getByRole("button", { name: /retry/i })).toHaveFocus();
```

- [ ] **Step 2: Run test and verify it fails**

Run: `npm test -- src/components/game/ResultCard.test.tsx`

Expected: fail until upgraded result UI exists.

- [ ] **Step 3: Redesign card hierarchy**

Order:

1. final score and EPM
2. PB delta
3. accuracy and shortcut efficiency
4. weakest skill or slowest task
5. retry, rematch seed, next task
6. expandable technical digest

- [ ] **Step 4: Keep analysis concise**

Do not show long explanations in the default result view.

- [ ] **Step 5: Run tests**

Run: `npm test -- src/components/game/ResultCard.test.tsx`

Expected: pass.

---

## Task 9: Add Leaderboard Shells Without Server Dependency

**Files:**
- Create: `src/components/leaderboard/LeaderboardShell.tsx`
- Create: `src/app/leaderboard/page.tsx`
- Modify: `src/components/game/GameShell.tsx`
- Test: `src/components/leaderboard/LeaderboardShell.test.tsx`

**Interfaces:**
- Consumes: local records for now.
- Produces: visual shell for global, friends, daily, weekly, skill-specific, and ranked tiers.

- [ ] **Step 1: Add layout tests**

```tsx
render(<LeaderboardShell />);
expect(screen.getByRole("tab", { name: /daily/i })).toBeInTheDocument();
expect(screen.getByRole("tab", { name: /friends/i })).toBeInTheDocument();
expect(screen.getByText(/near me/i)).toBeInTheDocument();
```

- [ ] **Step 2: Run test and verify it fails**

Run: `npm test -- src/components/leaderboard/LeaderboardShell.test.tsx`

Expected: fail until shell exists.

- [ ] **Step 3: Implement local/mock shell**

Use local data and empty states. Do not fake a live global service.

- [ ] **Step 4: Make beginners safe**

Default to personal rank bands, near-me placement, and skill-specific boards instead of only top global scores.

- [ ] **Step 5: Run tests**

Run: `npm test -- src/components/leaderboard/LeaderboardShell.test.tsx`

Expected: pass.

---

## Task 10: Add Mastery And Profile Progression

**Files:**
- Create: `src/domain/mastery/masteryTypes.ts`
- Create: `src/domain/mastery/calculateMastery.ts`
- Create: `src/components/profile/MasteryPanel.tsx`
- Modify: `src/components/profile/ProfilePanel.tsx`
- Test: `src/domain/mastery/calculateMastery.test.ts`

**Interfaces:**
- Consumes: local run history and challenge family metadata.
- Produces: skill mastery levels, badges, practice recommendations, and theme/cosmetic unlock signals.

- [ ] **Step 1: Add mastery tests**

```ts
expect(calculateMastery([
  { family: "selection", score: 900, accuracy: 1, shortcutEfficiency: 90 },
])).toMatchObject({
  recommendedFamily: "selection",
});
```

- [ ] **Step 2: Run test and verify it fails**

Run: `npm test -- src/domain/mastery/calculateMastery.test.ts`

Expected: fail until mastery domain exists.

- [ ] **Step 3: Define skill families**

Use professional categories: Navigation, Selection, Formatting, Formulas, Sort/Filter, Fill/Paste, Tables, Mixed Workflows.

- [ ] **Step 4: Implement mastery levels**

Use skill-based levels such as `new`, `steady`, `fast`, `sharp`, `elite`. Avoid childish naming.

- [ ] **Step 5: Add profile section**

Place mastery summary above recent runs. Keep recent run list intact.

- [ ] **Step 6: Run tests**

Run: `npm test -- src/domain/mastery/calculateMastery.test.ts`

Expected: pass.

---

## Task 11: Apply Grid Density And Spreadsheet-Native Polish

**Files:**
- Modify: `src/components/grid/gridMetrics.ts`
- Modify: `src/components/grid/SpreadsheetGrid.tsx`
- Modify: `src/components/grid/CellView.tsx`
- Modify: `src/components/grid/SelectionOverlay.tsx`
- Test: `src/components/grid/SpreadsheetGrid.test.tsx`

**Interfaces:**
- Consumes: `settings.grid.density`, `settings.grid.gridlineStrength`, `settings.accessibility.largeTargets`.
- Produces: stable grid dimensions chosen before a run starts.

- [ ] **Step 1: Add density tests**

```tsx
render(<SpreadsheetGrid grid={grid} density="compact" dispatch={vi.fn()} />);
expect(screen.getByTestId("spreadsheet-grid")).toHaveAttribute("data-density", "compact");
```

- [ ] **Step 2: Run test and verify it fails**

Run: `npm test -- src/components/grid/SpreadsheetGrid.test.tsx`

Expected: fail until density prop exists.

- [ ] **Step 3: Add density metrics**

Use a function:

```ts
export function getGridMetrics(density: GridDensity, largeTargets: boolean): GridMetrics;
```

- [ ] **Step 4: Preserve run stability**

Read density once when a run starts. Do not let settings changes resize an active grid mid-run.

- [ ] **Step 5: Run tests**

Run: `npm test -- src/components/grid/SpreadsheetGrid.test.tsx`

Expected: pass.

---

## Task 12: Final Visual QA And Verification

**Files:**
- Modify: `e2e/game.spec.ts`
- Modify: `e2e/settings.spec.ts`
- Create: `e2e/design.spec.ts`

**Interfaces:**
- Consumes: completed design implementation.
- Produces: confidence that the app is fast, keyboard-first, uncluttered, and accessible.

- [ ] **Step 1: Add Playwright checks**

Cover:

```ts
test("practice screen keeps grid dominant");
test("settings categories are keyboard reachable");
test("reduced motion disables decorative animation");
test("retry returns focus to the grid");
test("theme changes apply without reload");
```

- [ ] **Step 2: Run unit tests**

Run: `npm test`

Expected: all tests pass.

- [ ] **Step 3: Run typecheck**

Run: `npm run typecheck`

Expected: no TypeScript errors.

- [ ] **Step 4: Run lint**

Run: `npm run lint`

Expected: no lint errors.

- [ ] **Step 5: Run build**

Run: `npm run build`

Expected: production build succeeds.

- [ ] **Step 6: Run E2E**

Run: `npm run e2e`

Expected: Playwright suite passes.

- [ ] **Step 7: Manual design QA**

Check desktop Chrome at common viewport sizes:

- Practice screen has no overlapping text.
- Grid remains the largest visual object.
- Timer and stats do not shift layout.
- Theme cards are original and not Monkeytype-like by name or palette.
- Error/success feedback is visible but not loud.
- Result screen makes retry obvious.
- Settings are usable with keyboard only.

---

## Design AI Summary

Build an original Excel-speed game interface where the spreadsheet grid is the arena. The experience should be minimal, premium, keyboard-first, customizable, competitive, and satisfying. Do not make a SaaS dashboard. Do not copy Monkeytype. Translate the inspiration into spreadsheet-native decisions: semantic themes, live EPM/accuracy/shortcut stats, subtle cell feedback, fast retries, original sound cues, local-first settings, mastery progression, and humane competition.

## Recommended Implementation Order

1. Tokens and themes.
2. Expanded settings model.
3. Settings UI.
4. Live stats.
5. Practice frame.
6. Feedback/combo layer.
7. Results redesign.
8. Grid density polish.
9. Sound hooks.
10. Mastery/profile.
11. Leaderboard shell.
12. Full verification.

## Do Not Start By Building

Before coding, the implementing agent should reread:

- `README.md`
- `CURRENT_STATE.md`
- `ARCHITECTURE.md`
- `PRODUCT_STRATEGY.md`
- `src/components/game/GameShell.tsx`
- `src/components/game/ChallengeRun.tsx`
- `src/components/game/SessionRun.tsx`
- `src/components/grid/SpreadsheetGrid.tsx`
- `src/domain/settings/themes.ts`
- `src/hooks/useSettings.ts`

Then implement task-by-task with fresh tests and review checkpoints.
