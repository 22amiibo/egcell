import { describe, expect, it } from "vitest";

import {
  DEFAULT_SETTINGS,
  DEFAULT_THEME_ID,
  SETTINGS_KEY,
  THEME_PRESETS,
  readSettings,
  themeById,
  themeCssVars,
  writeSettings,
} from "@/domain/settings/themes";
import { createMemoryJsonStorage } from "@/lib/storage";

const HEX_COLOR = /^#[0-9a-f]{6}$/i;

describe("the theme presets", () => {
  it("ship a real range of options", () => {
    expect(THEME_PRESETS.length).toBeGreaterThanOrEqual(12);

    const schemes = new Set(THEME_PRESETS.map((preset) => preset.tokens.colorScheme));

    expect(schemes).toContain("dark");
    expect(schemes).toContain("light");
  });

  it("gives every preset a unique id and label", () => {
    const ids = THEME_PRESETS.map((preset) => preset.id);
    const labels = THEME_PRESETS.map((preset) => preset.label);

    expect(new Set(ids).size).toBe(ids.length);
    expect(new Set(labels).size).toBe(labels.length);
  });

  it("fills every token of every preset with a well-formed color", () => {
    for (const preset of THEME_PRESETS) {
      const vars = themeCssVars(preset.tokens);

      expect(preset.tokens).toMatchObject({
        background: expect.any(String),
        surface: expect.any(String),
        surfaceElevated: expect.any(String),
        gridLine: expect.any(String),
        gridLineStrong: expect.any(String),
        activeCell: expect.any(String),
        selectedRange: expect.any(String),
        correct: expect.any(String),
        warning: expect.any(String),
        error: expect.any(String),
        accent: expect.any(String),
        accentStrong: expect.any(String),
        textPrimary: expect.any(String),
        textMuted: expect.any(String),
        focusRing: expect.any(String),
        shadow: expect.any(String),
      });

      // Semantic variables plus backwards-compatible aliases must all be assigned per theme.
      expect(Object.keys(vars).length).toBeGreaterThanOrEqual(25);
      expect(vars["--color-background"]).toMatch(HEX_COLOR);
      expect(vars["--color-grid-line"]).toMatch(HEX_COLOR);
      expect(vars["--color-correct"]).toMatch(HEX_COLOR);
      expect(vars["--color-warning"]).toMatch(HEX_COLOR);
      expect(vars["--color-error"]).toMatch(HEX_COLOR);
      expect(vars["--motion-fast"]).toMatch(/^\d+ms$/);
      expect(vars["--motion-base"]).toMatch(/^\d+ms$/);
      expect(vars["--motion-slow"]).toMatch(/^\d+ms$/);
      expect(vars["--shadow-elevated"]).toContain("rgba");
    }
  });

  it("ships the original spreadsheet arena theme set", () => {
    expect(THEME_PRESETS.map((preset) => preset.label)).toEqual([
      "Ledger Noir",
      "Quarter Close",
      "OLED Ledger",
      "Study Light",
      "Arcade Pivot",
      "Audit Trail",
      "Graphite Desk",
      "Market Open",
      "Paper Grid",
      "Cyber Range",
      "Retro Cubicle",
      "Calm Formula",
      "Prism Sheet",
    ]);
  });

  it("includes the default, and the default comes first", () => {
    expect(THEME_PRESETS[0].id).toBe(DEFAULT_THEME_ID);
  });
});

describe("themeById", () => {
  it("finds a preset by id and falls back to the default for junk", () => {
    expect(themeById("paper-grid").id).toBe("paper-grid");
    expect(themeById("no-such-theme").id).toBe(DEFAULT_THEME_ID);
  });

  it("maps legacy theme ids to the closest original preset", () => {
    expect(themeById("excel-dark").id).toBe("ledger-noir");
    expect(themeById("paper").id).toBe("paper-grid");
  });
});

describe("settings storage", () => {
  it("round-trips a chosen theme", () => {
    const storage = createMemoryJsonStorage();

    writeSettings(storage, { themeId: "quarter-close" });

    expect(readSettings(storage)).toEqual({ themeId: "quarter-close" });
  });

  it("falls back to the default for malformed or unknown stored values", () => {
    expect(readSettings(createMemoryJsonStorage())).toEqual(DEFAULT_SETTINGS);
    expect(
      readSettings(createMemoryJsonStorage({ [SETTINGS_KEY]: { themeId: 42 } })),
    ).toEqual(DEFAULT_SETTINGS);
    expect(
      readSettings(createMemoryJsonStorage({ [SETTINGS_KEY]: { themeId: "gone" } })),
    ).toEqual(DEFAULT_SETTINGS);
    expect(readSettings(createMemoryJsonStorage({ [SETTINGS_KEY]: "junk" }))).toEqual(
      DEFAULT_SETTINGS,
    );
  });
});
