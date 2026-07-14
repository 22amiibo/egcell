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
    expect(screen.getByRole("button", { name: /Ledger Noir/ })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("exposes every settings category and its core controls", async () => {
    const user = userEvent.setup();

    render(<SettingsPanel />);

    for (const category of [
      "Appearance",
      "Grid",
      "Gameplay",
      "Scoring",
      "Help",
      "Feedback",
      "Sound",
      "Accessibility",
      "Privacy",
    ]) {
      expect(screen.getByRole("tab", { name: category })).toBeInTheDocument();
    }

    await user.click(screen.getByRole("tab", { name: "Grid" }));
    expect(screen.getByLabelText("Grid density")).toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: "Scoring" }));
    expect(screen.getByLabelText("Hotkey strictness")).toBeInTheDocument();
    // Mouse policy is gone: it duplicated hotkeyStrictness, nothing ever read it, and it
    // contradicted DECISIONS.md outright (§10).
    expect(screen.queryByLabelText("Mouse policy")).not.toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: "Help" }));
    expect(screen.getByLabelText("Confirm before revealing")).toBeChecked();
    expect(screen.getByLabelText("Auto-reveal in Practice")).not.toBeChecked();

    await user.click(screen.getByRole("tab", { name: "Feedback" }));
    expect(screen.getByLabelText("Live stats")).toBeChecked();
    expect(screen.getByLabelText("Shortcut flash")).toBeChecked();

    await user.click(screen.getByRole("tab", { name: "Sound" }));
    expect(screen.getByLabelText("PB pace sound")).toBeDisabled();
    expect(screen.getByLabelText("Ranked promotion sound")).toBeDisabled();
    expect(screen.getByLabelText("Daily complete sound")).toBeDisabled();

    await user.click(screen.getByRole("tab", { name: "Accessibility" }));
    expect(screen.getByLabelText("Reduced motion")).not.toBeChecked();
    expect(screen.getByLabelText("High contrast")).not.toBeChecked();
  });

  it("persists a tuning control immediately", async () => {
    const user = userEvent.setup();

    render(<SettingsPanel />);
    await user.click(screen.getByRole("tab", { name: "Grid" }));
    await user.selectOptions(screen.getByLabelText("Grid density"), "compact");

    expect(JSON.parse(window.localStorage.getItem(SETTINGS_KEY) ?? "{}")).toMatchObject({
      grid: { density: "compact" },
    });
  });

  it("applies accessibility preferences to the document root", async () => {
    const user = userEvent.setup();

    render(
      <>
        <ThemeApplier />
        <SettingsPanel />
      </>,
    );
    await user.click(screen.getByRole("tab", { name: "Accessibility" }));
    await user.click(screen.getByLabelText("Reduced motion"));

    expect(document.documentElement.dataset.reducedMotion).toBe("true");
    expect(document.documentElement.style.getPropertyValue("--motion-base")).toBe("0ms");
  });

  it("picking a preset restyles the document root and persists the choice", async () => {
    render(
      <>
        <ThemeApplier />
        <SettingsPanel />
      </>,
    );

    await userEvent.click(screen.getByRole("button", { name: /Quarter Close/ }));

    const root = document.documentElement;
    const quarterClose = themeById("quarter-close");

    expect(root.style.getPropertyValue("--color-background")).toBe(
      quarterClose.tokens.background,
    );
    expect(root.style.getPropertyValue("--color-accent")).toBe(quarterClose.tokens.accent);
    expect(root.dataset.theme).toBe("quarter-close");

    expect(JSON.parse(window.localStorage.getItem(SETTINGS_KEY) ?? "{}")).toMatchObject({
      appearance: { themeId: "quarter-close" },
    });

    expect(screen.getByRole("button", { name: /Quarter Close/ })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("button", { name: /Ledger Noir/ })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });
});
