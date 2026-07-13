import { describe, expect, it } from "vitest";

import {
  DEFAULT_SETTINGS,
  SETTINGS_KEY,
  coerceSettings,
  readSettings,
  writeSettings,
} from "@/domain/settings/themes";
import { createMemoryJsonStorage } from "@/lib/storage";

describe("expanded settings", () => {
  it("ships safe gameplay defaults", () => {
    expect(DEFAULT_SETTINGS.sound.enabled).toBe(false);
    expect(DEFAULT_SETTINGS.feedback.liveStats).toBe(true);
    expect(DEFAULT_SETTINGS.scoring.mousePolicy).toBe("allowed");
    expect(DEFAULT_SETTINGS.scoring.hotkeyStrictness).toBe("encouraged");
    expect(coerceSettings(DEFAULT_SETTINGS)).toEqual(DEFAULT_SETTINGS);
  });

  it("migrates legacy theme-only settings", () => {
    expect(coerceSettings({ themeId: "excel-dark" })).toEqual({
      ...DEFAULT_SETTINGS,
      appearance: {
        ...DEFAULT_SETTINGS.appearance,
        themeId: "ledger-noir",
      },
    });
  });

  it("falls back safely for malformed values", () => {
    expect(coerceSettings(null)).toEqual(DEFAULT_SETTINGS);
    expect(coerceSettings("junk")).toEqual(DEFAULT_SETTINGS);
    expect(coerceSettings({ sound: { volume: "loud" } })).toEqual(DEFAULT_SETTINGS);
    expect(coerceSettings({ appearance: { themeId: "gone" } })).toEqual(DEFAULT_SETTINGS);
  });

  it("persists the complete model locally", () => {
    const storage = createMemoryJsonStorage();
    const settings = {
      ...DEFAULT_SETTINGS,
      appearance: { ...DEFAULT_SETTINGS.appearance, themeId: "paper-grid" },
      feedback: { ...DEFAULT_SETTINGS.feedback, liveStats: false },
      sound: { ...DEFAULT_SETTINGS.sound, enabled: true, volume: 35 },
    };

    writeSettings(storage, settings);

    expect(readSettings(storage)).toEqual(settings);
    expect(storage.read(SETTINGS_KEY, null)).toEqual(settings);
  });
});
