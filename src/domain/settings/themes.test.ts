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

const HEX_COLOR = /^#[0-9a-f]{6}$/;

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

      // Nine variables per theme; a missing one would silently inherit the previous theme.
      expect(Object.keys(vars)).toHaveLength(9);

      for (const value of Object.values(vars)) {
        expect(value).toMatch(HEX_COLOR);
      }
    }
  });

  it("includes the default, and the default comes first", () => {
    expect(THEME_PRESETS[0].id).toBe(DEFAULT_THEME_ID);
  });
});

describe("themeById", () => {
  it("finds a preset by id and falls back to the default for junk", () => {
    expect(themeById("paper").id).toBe("paper");
    expect(themeById("no-such-theme").id).toBe(DEFAULT_THEME_ID);
  });
});

describe("settings storage", () => {
  it("round-trips a chosen theme", () => {
    const storage = createMemoryJsonStorage();

    writeSettings(storage, { themeId: "sepia" });

    expect(readSettings(storage)).toEqual({ themeId: "sepia" });
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
