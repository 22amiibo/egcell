import type { JsonStorage } from "@/lib/storage";

/**
 * A theme is a complete assignment of the nine design tokens the whole UI is built on, plus the
 * browser color-scheme. Swapping the tokens restyles every surface, line, and accent at once,
 * which is what makes a preset a real design choice rather than a tint.
 */
export type ThemeTokens = {
  canvas: string;
  surface: string;
  surfaceRaised: string;
  line: string;
  lineStrong: string;
  ink: string;
  muted: string;
  accent: string;
  accentStrong: string;
  colorScheme: "dark" | "light";
};

export type ThemePreset = {
  id: string;
  label: string;
  tokens: ThemeTokens;
};

export const DEFAULT_THEME_ID = "excel-dark";

export const THEME_PRESETS: ThemePreset[] = [
  {
    id: "excel-dark",
    label: "Excel Dark",
    tokens: {
      canvas: "#0b0d0f",
      surface: "#14181c",
      surfaceRaised: "#1b2026",
      line: "#262c33",
      lineStrong: "#39424c",
      ink: "#e8ecef",
      muted: "#8a949e",
      accent: "#21a366",
      accentStrong: "#2ec27e",
      colorScheme: "dark",
    },
  },
  {
    id: "excel-light",
    label: "Excel Light",
    tokens: {
      canvas: "#f6f8f7",
      surface: "#ffffff",
      surfaceRaised: "#eef2ef",
      line: "#d5dcd6",
      lineStrong: "#b3bfb5",
      ink: "#1d2b23",
      muted: "#5f6f65",
      accent: "#1d8a56",
      accentStrong: "#136b41",
      colorScheme: "light",
    },
  },
  {
    id: "midnight",
    label: "Midnight",
    tokens: {
      canvas: "#070b14",
      surface: "#0d1424",
      surfaceRaised: "#131c31",
      line: "#1e293f",
      lineStrong: "#324362",
      ink: "#dbe4f5",
      muted: "#7e8ba3",
      accent: "#3b74d9",
      accentStrong: "#5b8fef",
      colorScheme: "dark",
    },
  },
  {
    id: "paper",
    label: "Paper",
    tokens: {
      canvas: "#fafaf7",
      surface: "#ffffff",
      surfaceRaised: "#f1f1ec",
      line: "#dcdcd2",
      lineStrong: "#bdbdb0",
      ink: "#26261f",
      muted: "#6d6d61",
      accent: "#2b6cb0",
      accentStrong: "#1f5390",
      colorScheme: "light",
    },
  },
  {
    id: "sepia",
    label: "Sepia",
    tokens: {
      canvas: "#f4ecdd",
      surface: "#faf4e8",
      surfaceRaised: "#ece2cd",
      line: "#d8cbb0",
      lineStrong: "#bfae8d",
      ink: "#3d3020",
      muted: "#7d6f58",
      accent: "#b07a2b",
      accentStrong: "#8f5f1c",
      colorScheme: "light",
    },
  },
  {
    id: "contrast-dark",
    label: "High Contrast Dark",
    tokens: {
      canvas: "#000000",
      surface: "#0a0a0a",
      surfaceRaised: "#161616",
      line: "#3d3d3d",
      lineStrong: "#6b6b6b",
      ink: "#ffffff",
      muted: "#c9c9c9",
      accent: "#ffd60a",
      accentStrong: "#ffe14d",
      colorScheme: "dark",
    },
  },
  {
    id: "contrast-light",
    label: "High Contrast Light",
    tokens: {
      canvas: "#ffffff",
      surface: "#ffffff",
      surfaceRaised: "#f0f0f0",
      line: "#8f8f8f",
      lineStrong: "#4d4d4d",
      ink: "#000000",
      muted: "#333333",
      accent: "#0044cc",
      accentStrong: "#002d88",
      colorScheme: "light",
    },
  },
  {
    id: "ocean",
    label: "Ocean",
    tokens: {
      canvas: "#04121a",
      surface: "#0a1e29",
      surfaceRaised: "#102a38",
      line: "#1b3a4b",
      lineStrong: "#2d5268",
      ink: "#d7ecf4",
      muted: "#7fa3b3",
      accent: "#12a5c6",
      accentStrong: "#2cc3e4",
      colorScheme: "dark",
    },
  },
  {
    id: "forest",
    label: "Forest",
    tokens: {
      canvas: "#0b120c",
      surface: "#121c14",
      surfaceRaised: "#19271b",
      line: "#25392a",
      lineStrong: "#3b5a43",
      ink: "#e2eede",
      muted: "#8ba38c",
      accent: "#79b636",
      accentStrong: "#94d84a",
      colorScheme: "dark",
    },
  },
  {
    id: "rose",
    label: "Rose",
    tokens: {
      canvas: "#150a10",
      surface: "#1f1018",
      surfaceRaised: "#2a1621",
      line: "#3d2130",
      lineStrong: "#5c3349",
      ink: "#f4e3ec",
      muted: "#a98a9a",
      accent: "#d64a86",
      accentStrong: "#ef6ba2",
      colorScheme: "dark",
    },
  },
  {
    id: "amber-terminal",
    label: "Amber Terminal",
    tokens: {
      canvas: "#0d0a04",
      surface: "#15100a",
      surfaceRaised: "#1e160c",
      line: "#33270f",
      lineStrong: "#54400f",
      ink: "#ffb000",
      muted: "#a97d18",
      accent: "#ffb000",
      accentStrong: "#ffd166",
      colorScheme: "dark",
    },
  },
  {
    id: "green-terminal",
    label: "Green Terminal",
    tokens: {
      canvas: "#050b06",
      surface: "#09130b",
      surfaceRaised: "#0e1c10",
      line: "#173521",
      lineStrong: "#215433",
      ink: "#33ff66",
      muted: "#1fa347",
      accent: "#33ff66",
      accentStrong: "#7dffa3",
      colorScheme: "dark",
    },
  },
  {
    id: "nordic",
    label: "Nordic",
    tokens: {
      canvas: "#2e3440",
      surface: "#3b4252",
      surfaceRaised: "#434c5e",
      line: "#4c566a",
      lineStrong: "#616e88",
      ink: "#eceff4",
      muted: "#a3adc2",
      accent: "#88c0d0",
      accentStrong: "#8fbcbb",
      colorScheme: "dark",
    },
  },
  {
    id: "violet",
    label: "Violet",
    tokens: {
      canvas: "#191423",
      surface: "#221b30",
      surfaceRaised: "#2c2340",
      line: "#3d3156",
      lineStrong: "#584a78",
      ink: "#efe9fb",
      muted: "#a195bd",
      accent: "#9d6bff",
      accentStrong: "#b78aff",
      colorScheme: "dark",
    },
  },
  {
    id: "solar-light",
    label: "Solar Light",
    tokens: {
      canvas: "#fdf6e3",
      surface: "#fefbf0",
      surfaceRaised: "#f3ecd9",
      line: "#e0d8c0",
      lineStrong: "#c2b99e",
      ink: "#586e75",
      muted: "#93a1a1",
      accent: "#268bd2",
      accentStrong: "#1a6da8",
      colorScheme: "light",
    },
  },
  {
    id: "solar-dark",
    label: "Solar Dark",
    tokens: {
      canvas: "#002b36",
      surface: "#073642",
      surfaceRaised: "#0b4250",
      line: "#14515f",
      lineStrong: "#26697a",
      ink: "#eee8d5",
      muted: "#93a1a1",
      accent: "#b58900",
      accentStrong: "#cb4b16",
      colorScheme: "dark",
    },
  },
];

export function themeById(id: string): ThemePreset {
  return THEME_PRESETS.find((preset) => preset.id === id) ?? THEME_PRESETS[0];
}

/** The CSS custom properties the app's Tailwind theme reads. One place maps token to variable. */
export function themeCssVars(tokens: ThemeTokens): Record<string, string> {
  return {
    "--color-canvas": tokens.canvas,
    "--color-surface": tokens.surface,
    "--color-surface-raised": tokens.surfaceRaised,
    "--color-line": tokens.line,
    "--color-line-strong": tokens.lineStrong,
    "--color-ink": tokens.ink,
    "--color-muted": tokens.muted,
    "--color-accent": tokens.accent,
    "--color-accent-strong": tokens.accentStrong,
  };
}

export const SETTINGS_KEY = "excel-speed-trainer:v1:settings";

export type Settings = {
  themeId: string;
};

export const DEFAULT_SETTINGS: Settings = { themeId: DEFAULT_THEME_ID };

/** Unknown theme ids fall back to the default rather than breaking the page. */
export function readSettings(storage: JsonStorage): Settings {
  const raw = storage.read<unknown>(SETTINGS_KEY, null);

  if (typeof raw !== "object" || raw === null) {
    return DEFAULT_SETTINGS;
  }

  const candidate = raw as Partial<Settings>;

  if (typeof candidate.themeId !== "string") {
    return DEFAULT_SETTINGS;
  }

  return { themeId: themeById(candidate.themeId).id };
}

export function writeSettings(storage: JsonStorage, settings: Settings): void {
  storage.write(SETTINGS_KEY, settings);
}
