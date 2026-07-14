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
      {/* And on <body> for a reason that is not ours at all. `suppressHydrationWarning` covers the
          element it is written on and never its children, so the flag above does nothing here.
          Browser extensions add classes to <body> before React hydrates: a real one appended
          `kapture-loaded` to exactly this className and cost the dev overlay an issue. The mismatch
          is cosmetic — React keeps the class either way, and no overlay exists in production — but
          an overlay that cries wolf about someone else's extension is one a developer learns to
          ignore, and the next issue it reports will be ours. Scoped to this element's own
          attributes: a genuine mismatch anywhere in the tree below still reports. */}
      <body className="min-h-screen antialiased" suppressHydrationWarning>
        <script dangerouslySetInnerHTML={{ __html: themeBootScript }} />
        <ThemeApplier />
        {children}
      </body>
    </html>
  );
}
