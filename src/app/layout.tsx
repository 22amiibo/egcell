import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

import { ThemeApplier } from "@/components/settings/ThemeApplier";
import { SETTINGS_KEY, THEME_PRESETS, themeCssVars } from "@/domain/settings/themes";

export const metadata: Metadata = {
  title: "Excel Speed Trainer",
  description: "A spreadsheet speed game. Complete the challenge. Beat your best time.",
};

/**
 * Applies a saved theme before first paint, so a light-theme player never sees a dark flash.
 * The preset map is serialized at build time from the same source of truth the settings page
 * uses. ThemeApplier takes over after hydration for live changes.
 */
const themeBootScript = `(function () {
  try {
    var themes = ${JSON.stringify(
      Object.fromEntries(
        THEME_PRESETS.map((preset) => [
          preset.id,
          { vars: themeCssVars(preset.tokens), colorScheme: preset.tokens.colorScheme },
        ]),
      ),
    )};
    var raw = window.localStorage.getItem(${JSON.stringify(SETTINGS_KEY)});
    if (!raw) return;
    var settings = JSON.parse(raw);
    var themeId = settings.appearance ? settings.appearance.themeId : settings.themeId;
    var theme = themes[themeId];
    if (!theme) return;
    var root = document.documentElement;
    for (var property in theme.vars) {
      root.style.setProperty(property, theme.vars[property]);
    }
    root.style.colorScheme = theme.colorScheme;
    root.dataset.theme = themeId;
  } catch (error) {}
})();`;

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    // The boot script and the applier both write style onto <html> outside React's knowledge,
    // which is the documented case for suppressing the hydration warning on this one element.
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen antialiased">
        <script dangerouslySetInnerHTML={{ __html: themeBootScript }} />
        <ThemeApplier />
        {children}
      </body>
    </html>
  );
}
