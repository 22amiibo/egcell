import { act, screen, waitFor } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { hydrateRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { GameShell } from "@/components/game/GameShell";
import { DEFAULT_SETTINGS, SETTINGS_KEY } from "@/domain/settings/themes";

describe("GameShell saved grid presentation", () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    window.localStorage.clear();
    window.localStorage.setItem(
      SETTINGS_KEY,
      JSON.stringify({
        ...DEFAULT_SETTINGS,
        grid: {
          ...DEFAULT_SETTINGS.grid,
          density: "compact",
          gridlineStrength: "strong",
        },
        accessibility: {
          ...DEFAULT_SETTINGS.accessibility,
          largeTargets: true,
        },
      }),
    );
    container = document.createElement("div");
    document.body.append(container);
  });

  afterEach(() => {
    container.remove();
  });

  it("hydrates the first run with saved settings before the grid starts", async () => {
    container.innerHTML = renderToString(<GameShell />);
    const root = hydrateRoot(container, <GameShell />);

    await waitFor(() => {
      expect(screen.getByTestId("spreadsheet-grid")).toHaveAttribute("data-density", "compact");
    });
    expect(screen.getByTestId("spreadsheet-grid")).toHaveAttribute(
      "data-gridline-strength",
      "strong",
    );
    expect(screen.getByRole("button", { name: "A1" })).toHaveStyle({
      width: "116px",
      height: "40px",
    });

    await act(() => root.unmount());
  });
});
