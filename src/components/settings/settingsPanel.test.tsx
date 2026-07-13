import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";

import { SettingsPanel } from "@/components/settings/SettingsPanel";
import { ThemeApplier } from "@/components/settings/ThemeApplier";
import { SETTINGS_KEY, THEME_PRESETS, themeById } from "@/domain/settings/themes";

describe("the settings panel", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("offers every preset and marks the active one", () => {
    render(<SettingsPanel />);

    const gallery = screen.getByTestId("theme-presets");

    expect(gallery.querySelectorAll("button")).toHaveLength(THEME_PRESETS.length);
    expect(screen.getByRole("button", { name: /Excel Dark/ })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("picking a preset restyles the document root and persists the choice", async () => {
    render(
      <>
        <ThemeApplier />
        <SettingsPanel />
      </>,
    );

    await userEvent.click(screen.getByRole("button", { name: /Sepia/ }));

    const root = document.documentElement;
    const sepia = themeById("sepia");

    expect(root.style.getPropertyValue("--color-canvas")).toBe(sepia.tokens.canvas);
    expect(root.style.getPropertyValue("--color-accent")).toBe(sepia.tokens.accent);
    expect(root.dataset.theme).toBe("sepia");

    expect(JSON.parse(window.localStorage.getItem(SETTINGS_KEY) ?? "{}")).toEqual({
      themeId: "sepia",
    });

    expect(screen.getByRole("button", { name: /Sepia/ })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: /Excel Dark/ })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });
});
