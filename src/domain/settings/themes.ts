import type { JsonStorage } from "@/lib/storage";

export type ThemeTokens = {
  background: string;
  surface: string;
  surfaceElevated: string;
  gridLine: string;
  gridLineStrong: string;
  activeCell: string;
  selectedRange: string;
  correct: string;
  warning: string;
  error: string;
  accent: string;
  accentStrong: string;
  textPrimary: string;
  textMuted: string;
  focusRing: string;
  shadow: string;
  motionFast: string;
  motionBase: string;
  motionSlow: string;
  colorScheme: "dark" | "light";

  /** Compatibility aliases used by components while they migrate to semantic names. */
  canvas: string;
  surfaceRaised: string;
  line: string;
  lineStrong: string;
  ink: string;
  muted: string;
};

export type ThemePreset = {
  id: string;
  label: string;
  tokens: ThemeTokens;
};

type ThemeColors = Omit<
  ThemeTokens,
  "canvas" | "surfaceRaised" | "line" | "lineStrong" | "ink" | "muted"
>;

function createThemeTokens(tokens: ThemeColors): ThemeTokens {
  return {
    ...tokens,
    canvas: tokens.background,
    surfaceRaised: tokens.surfaceElevated,
    line: tokens.gridLine,
    lineStrong: tokens.gridLineStrong,
    ink: tokens.textPrimary,
    muted: tokens.textMuted,
  };
}

const MOTION = {
  motionFast: "90ms",
  motionBase: "160ms",
  motionSlow: "260ms",
} as const;

export const DEFAULT_THEME_ID = "ledger-noir";

export const THEME_PRESETS: ThemePreset[] = [
  {
    id: "ledger-noir",
    label: "Ledger Noir",
    tokens: createThemeTokens({
      background: "#0a0d0c",
      surface: "#14181c",
      surfaceElevated: "#1c2221",
      gridLine: "#27302d",
      gridLineStrong: "#3d4a45",
      activeCell: "#37c982",
      selectedRange: "#183d2d",
      correct: "#45d38b",
      warning: "#e9b949",
      error: "#f06a72",
      accent: "#2daf70",
      accentStrong: "#46d28d",
      textPrimary: "#edf2ef",
      textMuted: "#8f9c96",
      focusRing: "#68e2a4",
      shadow: "0 18px 60px rgba(0, 0, 0, 0.38)",
      ...MOTION,
      colorScheme: "dark",
    }),
  },
  {
    id: "quarter-close",
    label: "Quarter Close",
    tokens: createThemeTokens({
      background: "#11100e",
      surface: "#1b1916",
      surfaceElevated: "#25221d",
      gridLine: "#383229",
      gridLineStrong: "#554b3b",
      activeCell: "#f2b84b",
      selectedRange: "#49371d",
      correct: "#7ccf72",
      warning: "#f0b747",
      error: "#e36b5d",
      accent: "#d59a36",
      accentStrong: "#f0bd5a",
      textPrimary: "#f0eadf",
      textMuted: "#a69c8d",
      focusRing: "#ffd176",
      shadow: "0 18px 60px rgba(0, 0, 0, 0.4)",
      ...MOTION,
      colorScheme: "dark",
    }),
  },
  {
    id: "oled-ledger",
    label: "OLED Ledger",
    tokens: createThemeTokens({
      background: "#000000",
      surface: "#070908",
      surfaceElevated: "#101311",
      gridLine: "#242925",
      gridLineStrong: "#4b554e",
      activeCell: "#8cffc1",
      selectedRange: "#123824",
      correct: "#66f2a3",
      warning: "#ffd166",
      error: "#ff6678",
      accent: "#4ce28f",
      accentStrong: "#8cffbd",
      textPrimary: "#ffffff",
      textMuted: "#a6afa9",
      focusRing: "#a8ffce",
      shadow: "0 20px 72px rgba(0, 0, 0, 0.72)",
      ...MOTION,
      colorScheme: "dark",
    }),
  },
  {
    id: "study-light",
    label: "Study Light",
    tokens: createThemeTokens({
      background: "#f4f5f1",
      surface: "#ffffff",
      surfaceElevated: "#eaede7",
      gridLine: "#d1d7cf",
      gridLineStrong: "#aeb9ad",
      activeCell: "#276b50",
      selectedRange: "#d9eee4",
      correct: "#217a50",
      warning: "#9a650f",
      error: "#b63f4c",
      accent: "#2c7b5b",
      accentStrong: "#185b42",
      textPrimary: "#17231d",
      textMuted: "#5d6d64",
      focusRing: "#166b49",
      shadow: "0 14px 44px rgba(24, 45, 35, 0.14)",
      ...MOTION,
      colorScheme: "light",
    }),
  },
  {
    id: "arcade-pivot",
    label: "Arcade Pivot",
    tokens: createThemeTokens({
      background: "#100b19",
      surface: "#1b1228",
      surfaceElevated: "#281a3a",
      gridLine: "#432b59",
      gridLineStrong: "#65407e",
      activeCell: "#f4d35e",
      selectedRange: "#3b245a",
      correct: "#62e6a7",
      warning: "#ffd05b",
      error: "#ff628c",
      accent: "#c66bff",
      accentStrong: "#e29aff",
      textPrimary: "#f8efff",
      textMuted: "#af96c0",
      focusRing: "#f0adff",
      shadow: "0 18px 64px rgba(4, 0, 12, 0.52)",
      ...MOTION,
      colorScheme: "dark",
    }),
  },
  {
    id: "audit-trail",
    label: "Audit Trail",
    tokens: createThemeTokens({
      background: "#0c1114",
      surface: "#121b20",
      surfaceElevated: "#19272e",
      gridLine: "#28404a",
      gridLineStrong: "#3b5c68",
      activeCell: "#55c8d2",
      selectedRange: "#163943",
      correct: "#5fd29a",
      warning: "#e8b85a",
      error: "#ed6f7c",
      accent: "#3babb8",
      accentStrong: "#69d7df",
      textPrimary: "#e9f2f3",
      textMuted: "#8da4aa",
      focusRing: "#8ce6eb",
      shadow: "0 18px 58px rgba(0, 8, 12, 0.48)",
      ...MOTION,
      colorScheme: "dark",
    }),
  },
  {
    id: "graphite-desk",
    label: "Graphite Desk",
    tokens: createThemeTokens({
      background: "#111214",
      surface: "#1a1c1f",
      surfaceElevated: "#23262a",
      gridLine: "#34383d",
      gridLineStrong: "#50565e",
      activeCell: "#b9d4ff",
      selectedRange: "#293448",
      correct: "#73c99c",
      warning: "#ddb45b",
      error: "#dd737c",
      accent: "#86aee8",
      accentStrong: "#b2cefa",
      textPrimary: "#edf0f4",
      textMuted: "#959ca6",
      focusRing: "#cadcff",
      shadow: "0 18px 56px rgba(0, 0, 0, 0.42)",
      ...MOTION,
      colorScheme: "dark",
    }),
  },
  {
    id: "market-open",
    label: "Market Open",
    tokens: createThemeTokens({
      background: "#061216",
      surface: "#0c1d22",
      surfaceElevated: "#122a30",
      gridLine: "#1d3c43",
      gridLineStrong: "#2c5962",
      activeCell: "#33d6a6",
      selectedRange: "#11433c",
      correct: "#37d89a",
      warning: "#efc04d",
      error: "#ff6b71",
      accent: "#1ebf94",
      accentStrong: "#4be0b5",
      textPrimary: "#e6f6f3",
      textMuted: "#82aaa6",
      focusRing: "#70f0c9",
      shadow: "0 20px 64px rgba(0, 10, 12, 0.5)",
      ...MOTION,
      colorScheme: "dark",
    }),
  },
  {
    id: "paper-grid",
    label: "Paper Grid",
    tokens: createThemeTokens({
      background: "#f7f6f0",
      surface: "#fffefa",
      surfaceElevated: "#eceae0",
      gridLine: "#d6d2c5",
      gridLineStrong: "#b4ae9d",
      activeCell: "#315f96",
      selectedRange: "#dce9f5",
      correct: "#2d7d55",
      warning: "#966514",
      error: "#ae4650",
      accent: "#376fa8",
      accentStrong: "#214f80",
      textPrimary: "#292a26",
      textMuted: "#686a61",
      focusRing: "#245d96",
      shadow: "0 14px 42px rgba(42, 43, 38, 0.14)",
      ...MOTION,
      colorScheme: "light",
    }),
  },
  {
    id: "cyber-range",
    label: "Cyber Range",
    tokens: createThemeTokens({
      background: "#05080d",
      surface: "#09111a",
      surfaceElevated: "#0e1d29",
      gridLine: "#173346",
      gridLineStrong: "#24516a",
      activeCell: "#35e8ff",
      selectedRange: "#0d3847",
      correct: "#55efa8",
      warning: "#ffcf55",
      error: "#ff5c7a",
      accent: "#19bfd7",
      accentStrong: "#58e9fb",
      textPrimary: "#e9fbff",
      textMuted: "#79a8b4",
      focusRing: "#80f2ff",
      shadow: "0 20px 68px rgba(0, 4, 10, 0.62)",
      ...MOTION,
      colorScheme: "dark",
    }),
  },
  {
    id: "retro-cubicle",
    label: "Retro Cubicle",
    tokens: createThemeTokens({
      background: "#16120b",
      surface: "#211b10",
      surfaceElevated: "#2d2516",
      gridLine: "#44371f",
      gridLineStrong: "#67542e",
      activeCell: "#e7b647",
      selectedRange: "#49391a",
      correct: "#90c65e",
      warning: "#e8b94d",
      error: "#dc7160",
      accent: "#c99132",
      accentStrong: "#efbe55",
      textPrimary: "#f2dfad",
      textMuted: "#ad9565",
      focusRing: "#ffd16f",
      shadow: "0 18px 58px rgba(8, 5, 0, 0.5)",
      ...MOTION,
      colorScheme: "dark",
    }),
  },
  {
    id: "calm-formula",
    label: "Calm Formula",
    tokens: createThemeTokens({
      background: "#0e1515",
      surface: "#162020",
      surfaceElevated: "#1e2c2b",
      gridLine: "#2c403e",
      gridLineStrong: "#44615d",
      activeCell: "#7ccfc1",
      selectedRange: "#23433f",
      correct: "#72d0a1",
      warning: "#d8b662",
      error: "#d9767b",
      accent: "#61b8ab",
      accentStrong: "#8ad8cb",
      textPrimary: "#e5f0ed",
      textMuted: "#91aaa5",
      focusRing: "#a5e4d9",
      shadow: "0 18px 56px rgba(1, 8, 8, 0.44)",
      ...MOTION,
      colorScheme: "dark",
    }),
  },
  {
    id: "prism-sheet",
    label: "Prism Sheet",
    tokens: createThemeTokens({
      background: "#0e0c16",
      surface: "#181421",
      surfaceElevated: "#231c30",
      gridLine: "#382d48",
      gridLineStrong: "#55436c",
      activeCell: "#7fdcf2",
      selectedRange: "#302b51",
      correct: "#68dfa6",
      warning: "#efc15b",
      error: "#f06b91",
      accent: "#a979e8",
      accentStrong: "#d0a2ff",
      textPrimary: "#f4effb",
      textMuted: "#a69ab5",
      focusRing: "#e0bbff",
      shadow: "0 20px 66px rgba(5, 1, 13, 0.52)",
      ...MOTION,
      colorScheme: "dark",
    }),
  },
];

export function themeById(id: string): ThemePreset {
  const legacyThemeAliases: Record<string, string> = {
    "excel-dark": "ledger-noir",
    "excel-light": "study-light",
    midnight: "graphite-desk",
    paper: "paper-grid",
    sepia: "quarter-close",
    "contrast-dark": "oled-ledger",
    "contrast-light": "study-light",
    ocean: "audit-trail",
    forest: "calm-formula",
    rose: "prism-sheet",
    "amber-terminal": "retro-cubicle",
    "green-terminal": "market-open",
    nordic: "graphite-desk",
    violet: "arcade-pivot",
    "solar-light": "paper-grid",
    "solar-dark": "quarter-close",
  };
  const resolvedId = legacyThemeAliases[id] ?? id;

  return THEME_PRESETS.find((preset) => preset.id === resolvedId) ?? THEME_PRESETS[0];
}

/** Maps canonical semantic tokens and the previous public variables during migration. */
export function themeCssVars(tokens: ThemeTokens): Record<string, string> {
  return {
    "--color-background": tokens.background,
    "--color-surface": tokens.surface,
    "--color-surface-elevated": tokens.surfaceElevated,
    "--color-grid-line": tokens.gridLine,
    "--color-grid-line-strong": tokens.gridLineStrong,
    "--color-active-cell": tokens.activeCell,
    "--color-selected-range": tokens.selectedRange,
    "--color-correct": tokens.correct,
    "--color-warning": tokens.warning,
    "--color-error": tokens.error,
    "--color-accent": tokens.accent,
    "--color-accent-strong": tokens.accentStrong,
    "--color-text-primary": tokens.textPrimary,
    "--color-text-muted": tokens.textMuted,
    "--color-focus-ring": tokens.focusRing,
    "--shadow-elevated": tokens.shadow,
    "--motion-fast": tokens.motionFast,
    "--motion-base": tokens.motionBase,
    "--motion-standard": tokens.motionBase,
    "--motion-slow": tokens.motionSlow,

    "--color-canvas": tokens.background,
    "--color-surface-raised": tokens.surfaceElevated,
    "--color-line": tokens.gridLine,
    "--color-line-strong": tokens.gridLineStrong,
    "--color-ink": tokens.textPrimary,
    "--color-muted": tokens.textMuted,
  };
}

export const SETTINGS_KEY = "excel-speed-trainer:v1:settings";

export type GridDensity = "compact" | "comfortable" | "large";
export type HotkeyStrictness = "encouraged" | "strict" | "ranked";
export type PromptPosition = "top" | "left" | "bottom";
export type DefaultMode =
  | "ascent"
  | "main-speed"
  | "practice"
  | "hotkey"
  | "sprint-5"
  | "sprint-10"
  | "timed-30"
  | "timed-60";

export type Settings = {
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
    restartKeybind: "tab" | "command-r" | "control-r" | "escape";
    defaultMode: DefaultMode;
    skipBehavior: "practice-only" | "allowed" | "disabled";
  };
  scoring: {
    hotkeyStrictness: HotkeyStrictness;
    mistakePenalty: "light" | "standard" | "strict";
  };
  stats: {
    /**
     * The chart's last selection (§9.5). Kept in settings rather than a fifth storage key, and kept
     * as plain strings: an id a later release removes coerces back to the default rather than
     * leaving the profile pointed at a category that no longer exists.
     */
    categoryId: string;
    metricId: string;
  };
  help: {
    /**
     * Ask before revealing the fastest path mid-run. On by default, and not out of politeness: the
     * rules forbid un-assisting a run, so one stray click would destroy a personal-best attempt with
     * no undo (§7.1). A player who finds the prompt tiresome can switch it off; a player who never
     * meant to click gets their run back.
     */
    confirmBeforeReveal: boolean;
    /** Open Practice runs with the fastest path already showing. Such runs are assisted from the first render, and unranked. */
    autoRevealInPractice: boolean;
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
    pbPace: boolean;
    runComplete: boolean;
    rankedPromotion: boolean;
    dailyComplete: boolean;
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

export type ExpandedSettings = Settings;

export const DEFAULT_SETTINGS: Settings = {
  appearance: {
    themeId: DEFAULT_THEME_ID,
    accentMode: "steady",
    fontFamily: "system",
    reducedChrome: false,
  },
  grid: {
    density: "comfortable",
    showFormulaBar: true,
    showHeaders: true,
    gridlineStrength: "standard",
    promptPosition: "top",
  },
  gameplay: {
    instantRestart: true,
    restartKeybind: "tab",
    defaultMode: "ascent",
    skipBehavior: "practice-only",
  },
  scoring: {
    hotkeyStrictness: "encouraged",
    mistakePenalty: "standard",
  },
  stats: {
    categoryId: "speed",
    metricId: "score",
  },
  help: {
    confirmBeforeReveal: true,
    autoRevealInPractice: false,
  },
  feedback: {
    liveStats: true,
    combo: true,
    shortcutFlash: true,
    mistakeStyle: "subtle",
  },
  sound: {
    enabled: false,
    volume: 35,
    movement: true,
    success: true,
    error: true,
    combo: true,
    pbPace: true,
    runComplete: true,
    rankedPromotion: true,
    dailyComplete: true,
  },
  accessibility: {
    reducedMotion: false,
    highContrast: false,
    largeTargets: false,
  },
  privacy: {
    leaderboardOptIn: false,
    anonymousName: "Local player",
    rankedMode: false,
  },
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function section(value: unknown): Record<string, unknown> {
  return isRecord(value) ? value : {};
}

function bool(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function text(value: unknown, fallback: string, maxLength = 48): string {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim().slice(0, maxLength)
    : fallback;
}

function oneOf<const T extends readonly string[]>(
  value: unknown,
  values: T,
  fallback: T[number],
): T[number] {
  return typeof value === "string" && values.includes(value) ? (value as T[number]) : fallback;
}

export function coerceSettings(value: unknown): Settings {
  if (!isRecord(value)) {
    return DEFAULT_SETTINGS;
  }

  const legacyThemeId = typeof value.themeId === "string" ? value.themeId : null;
  const appearance = section(value.appearance);
  const grid = section(value.grid);
  const gameplay = section(value.gameplay);
  const scoring = section(value.scoring);
  const stats = section(value.stats);
  const help = section(value.help);
  const feedback = section(value.feedback);
  const sound = section(value.sound);
  const accessibility = section(value.accessibility);
  const privacy = section(value.privacy);
  const rawThemeId = legacyThemeId ?? appearance.themeId;
  const themeId = typeof rawThemeId === "string" ? themeById(rawThemeId).id : DEFAULT_THEME_ID;

  return {
    appearance: {
      themeId,
      accentMode: oneOf(
        appearance.accentMode,
        ["steady", "pace", "combo"] as const,
        DEFAULT_SETTINGS.appearance.accentMode,
      ),
      fontFamily: oneOf(
        appearance.fontFamily,
        ["system", "mono", "dyslexia"] as const,
        DEFAULT_SETTINGS.appearance.fontFamily,
      ),
      reducedChrome: bool(appearance.reducedChrome, DEFAULT_SETTINGS.appearance.reducedChrome),
    },
    grid: {
      density: oneOf(
        grid.density,
        ["compact", "comfortable", "large"] as const,
        DEFAULT_SETTINGS.grid.density,
      ),
      showFormulaBar: bool(grid.showFormulaBar, DEFAULT_SETTINGS.grid.showFormulaBar),
      showHeaders: bool(grid.showHeaders, DEFAULT_SETTINGS.grid.showHeaders),
      gridlineStrength: oneOf(
        grid.gridlineStrength,
        ["soft", "standard", "strong"] as const,
        DEFAULT_SETTINGS.grid.gridlineStrength,
      ),
      promptPosition: oneOf(
        grid.promptPosition,
        ["top", "left", "bottom"] as const,
        DEFAULT_SETTINGS.grid.promptPosition,
      ),
    },
    gameplay: {
      instantRestart: bool(gameplay.instantRestart, DEFAULT_SETTINGS.gameplay.instantRestart),
      restartKeybind: oneOf(
        gameplay.restartKeybind,
        ["tab", "command-r", "control-r", "escape"] as const,
        DEFAULT_SETTINGS.gameplay.restartKeybind,
      ),
      defaultMode: oneOf(
        gameplay.defaultMode,
        [
          "ascent",
          "main-speed",
          "practice",
          "hotkey",
          "sprint-5",
          "sprint-10",
          "timed-30",
          "timed-60",
        ] as const,
        DEFAULT_SETTINGS.gameplay.defaultMode,
      ),
      skipBehavior: oneOf(
        gameplay.skipBehavior,
        ["practice-only", "allowed", "disabled"] as const,
        DEFAULT_SETTINGS.gameplay.skipBehavior,
      ),
    },
    scoring: {
      hotkeyStrictness: oneOf(
        scoring.hotkeyStrictness,
        ["encouraged", "strict", "ranked"] as const,
        DEFAULT_SETTINGS.scoring.hotkeyStrictness,
      ),
      mistakePenalty: oneOf(
        scoring.mistakePenalty,
        ["light", "standard", "strict"] as const,
        DEFAULT_SETTINGS.scoring.mistakePenalty,
      ),
    },
    stats: {
      categoryId: text(stats.categoryId, DEFAULT_SETTINGS.stats.categoryId),
      metricId: text(stats.metricId, DEFAULT_SETTINGS.stats.metricId),
    },
    help: {
      confirmBeforeReveal: bool(help.confirmBeforeReveal, DEFAULT_SETTINGS.help.confirmBeforeReveal),
      autoRevealInPractice: bool(
        help.autoRevealInPractice,
        DEFAULT_SETTINGS.help.autoRevealInPractice,
      ),
    },
    feedback: {
      liveStats: bool(feedback.liveStats, DEFAULT_SETTINGS.feedback.liveStats),
      combo: bool(feedback.combo, DEFAULT_SETTINGS.feedback.combo),
      shortcutFlash: bool(feedback.shortcutFlash, DEFAULT_SETTINGS.feedback.shortcutFlash),
      mistakeStyle: oneOf(
        feedback.mistakeStyle,
        ["subtle", "clear", "minimal"] as const,
        DEFAULT_SETTINGS.feedback.mistakeStyle,
      ),
    },
    sound: {
      enabled: bool(sound.enabled, DEFAULT_SETTINGS.sound.enabled),
      volume:
        typeof sound.volume === "number" && Number.isFinite(sound.volume)
          ? Math.min(100, Math.max(0, Math.round(sound.volume)))
          : DEFAULT_SETTINGS.sound.volume,
      movement: bool(sound.movement, DEFAULT_SETTINGS.sound.movement),
      success: bool(sound.success, DEFAULT_SETTINGS.sound.success),
      error: bool(sound.error, DEFAULT_SETTINGS.sound.error),
      combo: bool(sound.combo, DEFAULT_SETTINGS.sound.combo),
      pbPace: bool(sound.pbPace, DEFAULT_SETTINGS.sound.pbPace),
      runComplete: bool(sound.runComplete, DEFAULT_SETTINGS.sound.runComplete),
      rankedPromotion: bool(
        sound.rankedPromotion,
        DEFAULT_SETTINGS.sound.rankedPromotion,
      ),
      dailyComplete: bool(sound.dailyComplete, DEFAULT_SETTINGS.sound.dailyComplete),
    },
    accessibility: {
      reducedMotion: bool(
        accessibility.reducedMotion,
        DEFAULT_SETTINGS.accessibility.reducedMotion,
      ),
      highContrast: bool(accessibility.highContrast, DEFAULT_SETTINGS.accessibility.highContrast),
      largeTargets: bool(accessibility.largeTargets, DEFAULT_SETTINGS.accessibility.largeTargets),
    },
    privacy: {
      leaderboardOptIn: bool(
        privacy.leaderboardOptIn,
        DEFAULT_SETTINGS.privacy.leaderboardOptIn,
      ),
      anonymousName: text(privacy.anonymousName, DEFAULT_SETTINGS.privacy.anonymousName),
      rankedMode: bool(privacy.rankedMode, DEFAULT_SETTINGS.privacy.rankedMode),
    },
  };
}

export function readSettings(storage: JsonStorage): Settings {
  return coerceSettings(storage.read<unknown>(SETTINGS_KEY, null));
}

export function writeSettings(storage: JsonStorage, settings: Settings): void {
  storage.write(SETTINGS_KEY, settings);
}
