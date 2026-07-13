"use client";

import { useEffect } from "react";

import { themeById, themeCssVars } from "@/domain/settings/themes";
import { useSettings } from "@/hooks/useSettings";

/**
 * Applies the chosen theme to the document root, where the Tailwind tokens read their values.
 * It renders nothing. The layout also injects a tiny inline script that does the same thing
 * before first paint, so a saved theme never flashes the default; this component takes over from
 * there and handles live changes from the settings page.
 */
export function ThemeApplier() {
  const { settings } = useSettings();

  useEffect(() => {
    const root = document.documentElement;
    const theme = themeById(settings.appearance.themeId);
    const fontFamilies = {
      system: "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
      mono: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
      dyslexia: "Verdana, Tahoma, Arial, sans-serif",
    } as const;
    const gridHeights = { compact: "26px", comfortable: "32px", large: "40px" } as const;

    for (const [property, value] of Object.entries(themeCssVars(theme.tokens))) {
      root.style.setProperty(property, value);
    }

    root.style.setProperty("--font-game", fontFamilies[settings.appearance.fontFamily]);
    root.style.setProperty("--grid-cell-height", gridHeights[settings.grid.density]);

    if (settings.accessibility.reducedMotion) {
      root.style.setProperty("--motion-fast", "0ms");
      root.style.setProperty("--motion-base", "0ms");
      root.style.setProperty("--motion-standard", "0ms");
      root.style.setProperty("--motion-slow", "0ms");
    }

    root.style.colorScheme = theme.tokens.colorScheme;
    root.dataset.theme = theme.id;
    root.dataset.font = settings.appearance.fontFamily;
    root.dataset.gridDensity = settings.grid.density;
    root.dataset.gridlineStrength = settings.grid.gridlineStrength;
    root.dataset.reducedMotion = String(settings.accessibility.reducedMotion);
    root.dataset.highContrast = String(settings.accessibility.highContrast);
    root.dataset.largeTargets = String(settings.accessibility.largeTargets);
    root.dataset.reducedChrome = String(settings.appearance.reducedChrome);
  }, [settings]);

  return null;
}
