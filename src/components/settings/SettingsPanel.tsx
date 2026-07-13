"use client";

import Link from "next/link";

import { THEME_PRESETS, type ThemePreset } from "@/domain/settings/themes";
import { useSettings } from "@/hooks/useSettings";

function Swatch({ color }: { color: string }) {
  return (
    <span
      aria-hidden
      className="h-3 w-3 rounded-full border border-black/20"
      style={{ backgroundColor: color }}
    />
  );
}

function PresetCard({
  preset,
  isActive,
  onPick,
}: {
  preset: ThemePreset;
  isActive: boolean;
  onPick: (id: string) => void;
}) {
  const { tokens } = preset;

  return (
    <button
      type="button"
      aria-pressed={isActive}
      onClick={() => onPick(preset.id)}
      // The card previews itself in its own colors, whatever theme is currently applied.
      style={{
        backgroundColor: tokens.canvas,
        borderColor: isActive ? tokens.accentStrong : tokens.line,
      }}
      className={[
        "flex flex-col gap-2 rounded-lg border-2 p-3 text-left transition-transform",
        isActive ? "" : "hover:scale-[1.02]",
      ].join(" ")}
    >
      <span className="text-[13px] font-semibold" style={{ color: tokens.ink }}>
        {preset.label}
      </span>

      <span className="flex items-center gap-1.5">
        <Swatch color={tokens.surface} />
        <Swatch color={tokens.surfaceRaised} />
        <Swatch color={tokens.ink} />
        <Swatch color={tokens.accent} />
        <Swatch color={tokens.accentStrong} />
      </span>

      <span className="text-[11px]" style={{ color: tokens.muted }}>
        {tokens.colorScheme === "dark" ? "dark" : "light"}
        {isActive ? " · active" : ""}
      </span>
    </button>
  );
}

/**
 * The design of the game is the player's choice. Every preset re-assigns the full token set, so
 * picking one restyles everything, instantly and on both pages, and the choice stays on this
 * device.
 */
export function SettingsPanel() {
  const { settings, setThemeId } = useSettings();

  return (
    <main className="flex min-h-screen flex-col">
      <header className="flex items-center justify-between gap-6 border-b border-line px-6 py-3">
        <span className="text-[13px] font-semibold tracking-tight text-ink">
          Excel Speed Trainer
        </span>
        <Link
          href="/"
          className="rounded border border-line px-2 py-1 text-[12px] font-medium text-muted transition-colors hover:bg-surface-raised hover:text-ink"
        >
          Back to the game
        </Link>
      </header>

      <div className="flex flex-1 justify-center px-6 py-10">
        <div className="flex w-full max-w-3xl flex-col gap-8">
          <div className="flex items-baseline justify-between">
            <h1 className="text-xl font-semibold tracking-tight text-ink">Settings</h1>
            <span className="text-[12px] text-muted">stored on this device only</span>
          </div>

          <section className="flex flex-col gap-3">
            <h2 className="text-[11px] font-medium tracking-widest text-muted uppercase">Theme</h2>
            <p className="text-[13px] text-muted">
              Pick a preset and the whole game restyles: grid, cards, timer, everything.
            </p>

            <div
              data-testid="theme-presets"
              className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4"
            >
              {THEME_PRESETS.map((preset) => (
                <PresetCard
                  key={preset.id}
                  preset={preset}
                  isActive={settings.themeId === preset.id}
                  onPick={setThemeId}
                />
              ))}
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
