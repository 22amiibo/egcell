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

    for (const [property, value] of Object.entries(themeCssVars(theme.tokens))) {
      root.style.setProperty(property, value);
    }

    root.style.colorScheme = theme.tokens.colorScheme;
    root.dataset.theme = theme.id;
  }, [settings.appearance.themeId]);

  return null;
}
