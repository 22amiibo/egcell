"use client";

import Link from "next/link";
import { useState } from "react";

import {
  SettingControl,
  Toggle,
  controlClassName,
} from "@/components/settings/SettingControl";
import {
  SETTINGS_CATEGORIES,
  type SettingsCategoryId,
} from "@/components/settings/settingsSchema";
import {
  THEME_PRESETS,
  type Settings,
  type ThemePreset,
} from "@/domain/settings/themes";
import { useSettings } from "@/hooks/useSettings";

const SOUND_CONTROLS = [
  { key: "movement", label: "Movement" },
  { key: "success", label: "Success" },
  { key: "error", label: "Error" },
  { key: "combo", label: "Combo" },
  { key: "pbPace", label: "PB pace" },
  { key: "runComplete", label: "Run complete" },
  { key: "rankedPromotion", label: "Ranked promotion" },
  { key: "dailyComplete", label: "Daily complete" },
] as const;

function ThemePreview({ preset, active, onPick }: { preset: ThemePreset; active: boolean; onPick: () => void }) {
  const { tokens } = preset;

  return (
    <button
      type="button"
      aria-label={preset.label}
      aria-pressed={active}
      onClick={onPick}
      className="group overflow-hidden rounded-lg border-2 text-left transition-transform hover:-translate-y-0.5"
      style={{
        backgroundColor: tokens.background,
        borderColor: active ? tokens.accentStrong : tokens.gridLine,
        boxShadow: active ? `0 0 0 1px ${tokens.accent}` : "none",
      }}
    >
      <span className="grid h-12 grid-cols-4 grid-rows-2" aria-hidden>
        {Array.from({ length: 8 }, (_, index) => (
          <span
            key={index}
            style={{
              borderColor: index === 5 ? tokens.activeCell : tokens.gridLine,
              backgroundColor: index === 5 ? tokens.selectedRange : tokens.surface,
            }}
            className="border-r border-b"
          />
        ))}
      </span>
      <span className="flex items-center justify-between gap-2 px-2.5 py-2">
        <span className="truncate text-[11px] font-semibold" style={{ color: tokens.textPrimary }}>
          {preset.label}
        </span>
        <span
          aria-hidden
          className="h-2 w-2 shrink-0 rounded-full"
          style={{ backgroundColor: tokens.accentStrong }}
        />
      </span>
    </button>
  );
}

function SelectControl({
  id,
  label,
  value,
  options,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (value: string) => void;
}) {
  return (
    <select
      id={id}
      aria-label={label}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className={controlClassName}
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}

export function SettingsPanel() {
  const { settings, setSettings, setThemeId } = useSettings();
  const [category, setCategory] = useState<SettingsCategoryId>("appearance");
  const activeCategory = SETTINGS_CATEGORIES.find((item) => item.id === category)!;

  function updateSection<K extends keyof Settings>(key: K, patch: Partial<Settings[K]>): void {
    setSettings((current) => ({
      ...current,
      [key]: { ...current[key], ...patch },
    }));
  }

  return (
    <main className="flex min-h-screen flex-col bg-canvas">
      <header className="flex items-center justify-between gap-6 border-b border-line px-5 py-3 sm:px-7">
        <span className="text-[13px] font-semibold tracking-tight text-ink">Excel Speed Trainer</span>
        <Link
          href="/"
          className="rounded-md border border-line px-2.5 py-1.5 text-[12px] font-medium text-muted transition-colors hover:bg-surface-raised hover:text-ink"
        >
          Back to the game
        </Link>
      </header>

      <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-5 py-7 sm:px-7">
        <div className="flex items-baseline justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-ink">Settings</h1>
            <p className="mt-1 text-[12px] text-muted">Tune the arena. Changes stay on this device.</p>
          </div>
          <span className="hidden text-[11px] text-muted sm:block">local preferences</span>
        </div>

        <div className="grid min-h-[34rem] gap-4 md:grid-cols-[12rem_minmax(0,1fr)]">
          <nav
            role="tablist"
            aria-label="Settings categories"
            className="flex gap-1 overflow-x-auto rounded-xl border border-line bg-surface p-1.5 md:flex-col md:self-start"
          >
            {SETTINGS_CATEGORIES.map((item) => (
              <button
                key={item.id}
                id={`settings-tab-${item.id}`}
                type="button"
                role="tab"
                aria-selected={category === item.id}
                aria-controls={`settings-panel-${item.id}`}
                onClick={() => setCategory(item.id)}
                className={[
                  "shrink-0 rounded-lg px-3 py-2 text-left text-[12px] transition-colors",
                  category === item.id
                    ? "bg-surface-raised font-semibold text-ink"
                    : "text-muted hover:bg-surface-raised/60 hover:text-ink",
                ].join(" ")}
              >
                {item.label}
              </button>
            ))}
          </nav>

          <section
            id={`settings-panel-${category}`}
            role="tabpanel"
            aria-labelledby={`settings-tab-${category}`}
            className="rounded-xl border border-line bg-surface px-4 py-4 shadow-[var(--shadow-elevated)] sm:px-6"
          >
            <div className="mb-4 border-b border-line pb-4">
              <h2 className="text-[15px] font-semibold text-ink">{activeCategory.label}</h2>
              <p className="mt-1 text-[12px] text-muted">{activeCategory.description}</p>
            </div>

            {category === "appearance" && (
              <div className="space-y-4">
                <div>
                  <h3 className="mb-2 text-[11px] font-medium tracking-widest text-muted uppercase">Theme</h3>
                  <div data-testid="theme-presets" className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
                    {THEME_PRESETS.map((preset) => (
                      <ThemePreview
                        key={preset.id}
                        preset={preset}
                        active={settings.appearance.themeId === preset.id}
                        onPick={() => setThemeId(preset.id)}
                      />
                    ))}
                  </div>
                </div>
                <div>
                  <SettingControl label="Accent mode" htmlFor="accent-mode">
                    <SelectControl id="accent-mode" label="Accent mode" value={settings.appearance.accentMode} options={[{ value: "steady", label: "Steady" }, { value: "pace", label: "PB pace" }, { value: "combo", label: "Combo" }]} onChange={(value) => updateSection("appearance", { accentMode: value as Settings["appearance"]["accentMode"] })} />
                  </SettingControl>
                  <SettingControl label="Font family" htmlFor="font-family">
                    <SelectControl id="font-family" label="Font family" value={settings.appearance.fontFamily} options={[{ value: "system", label: "System" }, { value: "mono", label: "Monospace" }, { value: "dyslexia", label: "Readable" }]} onChange={(value) => updateSection("appearance", { fontFamily: value as Settings["appearance"]["fontFamily"] })} />
                  </SettingControl>
                  <SettingControl label="Reduced chrome" description="Hide secondary decoration during runs." htmlFor="reduced-chrome">
                    <Toggle id="reduced-chrome" label="Reduced chrome" checked={settings.appearance.reducedChrome} onChange={(value) => updateSection("appearance", { reducedChrome: value })} />
                  </SettingControl>
                </div>
              </div>
            )}

            {category === "grid" && (
              <div>
                <SettingControl label="Grid density" htmlFor="grid-density">
                  <SelectControl id="grid-density" label="Grid density" value={settings.grid.density} options={[{ value: "compact", label: "Compact" }, { value: "comfortable", label: "Comfortable" }, { value: "large", label: "Large" }]} onChange={(value) => updateSection("grid", { density: value as Settings["grid"]["density"] })} />
                </SettingControl>
                <SettingControl label="Formula bar" htmlFor="show-formula-bar"><Toggle id="show-formula-bar" label="Formula bar" checked={settings.grid.showFormulaBar} onChange={(value) => updateSection("grid", { showFormulaBar: value })} /></SettingControl>
                <SettingControl label="Headers" htmlFor="show-headers"><Toggle id="show-headers" label="Headers" checked={settings.grid.showHeaders} onChange={(value) => updateSection("grid", { showHeaders: value })} /></SettingControl>
                <SettingControl label="Gridline strength" htmlFor="gridline-strength"><SelectControl id="gridline-strength" label="Gridline strength" value={settings.grid.gridlineStrength} options={[{ value: "soft", label: "Soft" }, { value: "standard", label: "Standard" }, { value: "strong", label: "Strong" }]} onChange={(value) => updateSection("grid", { gridlineStrength: value as Settings["grid"]["gridlineStrength"] })} /></SettingControl>
                <SettingControl label="Prompt position" htmlFor="prompt-position"><SelectControl id="prompt-position" label="Prompt position" value={settings.grid.promptPosition} options={[{ value: "top", label: "Top" }, { value: "left", label: "Left" }, { value: "bottom", label: "Bottom" }]} onChange={(value) => updateSection("grid", { promptPosition: value as Settings["grid"]["promptPosition"] })} /></SettingControl>
              </div>
            )}

            {category === "gameplay" && (
              <div>
                <SettingControl label="Instant restart" htmlFor="instant-restart"><Toggle id="instant-restart" label="Instant restart" checked={settings.gameplay.instantRestart} onChange={(value) => updateSection("gameplay", { instantRestart: value })} /></SettingControl>
                <SettingControl label="Restart key" htmlFor="restart-key"><SelectControl id="restart-key" label="Restart key" value={settings.gameplay.restartKeybind} options={[{ value: "tab", label: "Tab" }, { value: "command-r", label: "Cmd + R" }, { value: "control-r", label: "Ctrl + R" }, { value: "escape", label: "Escape" }]} onChange={(value) => updateSection("gameplay", { restartKeybind: value as Settings["gameplay"]["restartKeybind"] })} /></SettingControl>
                <SettingControl label="Default mode" htmlFor="default-mode"><SelectControl id="default-mode" label="Default mode" value={settings.gameplay.defaultMode} options={[{ value: "main-speed", label: "Speed" }, { value: "practice", label: "Practice" }, { value: "sprint-5", label: "Sprint 5" }, { value: "sprint-10", label: "Sprint 10" }, { value: "timed-30", label: "30 seconds" }, { value: "timed-60", label: "60 seconds" }]} onChange={(value) => updateSection("gameplay", { defaultMode: value as Settings["gameplay"]["defaultMode"] })} /></SettingControl>
                <SettingControl label="Skip behavior" htmlFor="skip-behavior"><SelectControl id="skip-behavior" label="Skip behavior" value={settings.gameplay.skipBehavior} options={[{ value: "practice-only", label: "Practice only" }, { value: "allowed", label: "Allowed" }, { value: "disabled", label: "Disabled" }]} onChange={(value) => updateSection("gameplay", { skipBehavior: value as Settings["gameplay"]["skipBehavior"] })} /></SettingControl>
              </div>
            )}

            {category === "scoring" && (
              <div>
                <SettingControl label="Mouse policy" htmlFor="mouse-policy"><SelectControl id="mouse-policy" label="Mouse policy" value={settings.scoring.mousePolicy} options={[{ value: "allowed", label: "Allowed" }, { value: "penalized", label: "Penalized" }, { value: "disabled", label: "Disabled" }]} onChange={(value) => updateSection("scoring", { mousePolicy: value as Settings["scoring"]["mousePolicy"] })} /></SettingControl>
                <SettingControl label="Hotkey strictness" htmlFor="hotkey-strictness"><SelectControl id="hotkey-strictness" label="Hotkey strictness" value={settings.scoring.hotkeyStrictness} options={[{ value: "encouraged", label: "Encouraged" }, { value: "strict", label: "Strict" }, { value: "ranked", label: "Ranked" }]} onChange={(value) => updateSection("scoring", { hotkeyStrictness: value as Settings["scoring"]["hotkeyStrictness"] })} /></SettingControl>
                <SettingControl label="Mistake penalty" htmlFor="mistake-penalty"><SelectControl id="mistake-penalty" label="Mistake penalty" value={settings.scoring.mistakePenalty} options={[{ value: "light", label: "Light" }, { value: "standard", label: "Standard" }, { value: "strict", label: "Strict" }]} onChange={(value) => updateSection("scoring", { mistakePenalty: value as Settings["scoring"]["mistakePenalty"] })} /></SettingControl>
              </div>
            )}

            {category === "help" && (
              <div>
                <SettingControl label="Confirm before revealing" description="Revealing the fastest path unranks the run, and cannot be undone." htmlFor="confirm-before-reveal"><Toggle id="confirm-before-reveal" label="Confirm before revealing" checked={settings.help.confirmBeforeReveal} onChange={(value) => updateSection("help", { confirmBeforeReveal: value })} /></SettingControl>
                <SettingControl label="Auto-reveal in Practice" description="Practice runs open with the path already showing. Those runs are unranked." htmlFor="auto-reveal-practice"><Toggle id="auto-reveal-practice" label="Auto-reveal in Practice" checked={settings.help.autoRevealInPractice} onChange={(value) => updateSection("help", { autoRevealInPractice: value })} /></SettingControl>
              </div>
            )}

            {category === "feedback" && (
              <div>
                <SettingControl label="Live stats" htmlFor="live-stats"><Toggle id="live-stats" label="Live stats" checked={settings.feedback.liveStats} onChange={(value) => updateSection("feedback", { liveStats: value })} /></SettingControl>
                <SettingControl label="Combo" htmlFor="combo"><Toggle id="combo" label="Combo" checked={settings.feedback.combo} onChange={(value) => updateSection("feedback", { combo: value })} /></SettingControl>
                <SettingControl label="Shortcut flash" htmlFor="shortcut-flash"><Toggle id="shortcut-flash" label="Shortcut flash" checked={settings.feedback.shortcutFlash} onChange={(value) => updateSection("feedback", { shortcutFlash: value })} /></SettingControl>
                <SettingControl label="Mistake style" htmlFor="mistake-style"><SelectControl id="mistake-style" label="Mistake style" value={settings.feedback.mistakeStyle} options={[{ value: "subtle", label: "Subtle" }, { value: "clear", label: "Clear" }, { value: "minimal", label: "Minimal" }]} onChange={(value) => updateSection("feedback", { mistakeStyle: value as Settings["feedback"]["mistakeStyle"] })} /></SettingControl>
              </div>
            )}

            {category === "sound" && (
              <div>
                <SettingControl label="Sound" description="Off by default." htmlFor="sound-enabled"><Toggle id="sound-enabled" label="Sound" checked={settings.sound.enabled} onChange={(value) => updateSection("sound", { enabled: value })} /></SettingControl>
                <SettingControl label={`Volume · ${settings.sound.volume}%`} htmlFor="sound-volume"><input id="sound-volume" aria-label="Volume" type="range" min="0" max="100" step="5" value={settings.sound.volume} disabled={!settings.sound.enabled} onChange={(event) => updateSection("sound", { volume: Number(event.target.value) })} className="w-40 accent-accent disabled:opacity-40" /></SettingControl>
                {SOUND_CONTROLS.map(({ key, label }) => {
                  return <SettingControl key={key} label={label} htmlFor={`sound-${key}`}><Toggle id={`sound-${key}`} label={`${label} sound`} checked={settings.sound[key]} disabled={!settings.sound.enabled} onChange={(value) => updateSection("sound", { [key]: value })} /></SettingControl>;
                })}
              </div>
            )}

            {category === "accessibility" && (
              <div>
                <SettingControl label="Reduced motion" htmlFor="reduced-motion"><Toggle id="reduced-motion" label="Reduced motion" checked={settings.accessibility.reducedMotion} onChange={(value) => updateSection("accessibility", { reducedMotion: value })} /></SettingControl>
                <SettingControl label="High contrast" htmlFor="high-contrast"><Toggle id="high-contrast" label="High contrast" checked={settings.accessibility.highContrast} onChange={(value) => updateSection("accessibility", { highContrast: value })} /></SettingControl>
                <SettingControl label="Large targets" htmlFor="large-targets"><Toggle id="large-targets" label="Large targets" checked={settings.accessibility.largeTargets} onChange={(value) => updateSection("accessibility", { largeTargets: value })} /></SettingControl>
              </div>
            )}

            {category === "privacy" && (
              <div>
                <div className="mb-3 rounded-lg border border-line bg-surface-raised px-3 py-2 text-[11px] text-muted">Online competition is not connected. These preferences remain local.</div>
                <SettingControl label="Leaderboard opt-in" htmlFor="leaderboard-opt-in"><Toggle id="leaderboard-opt-in" label="Leaderboard opt-in" checked={settings.privacy.leaderboardOptIn} onChange={(value) => updateSection("privacy", { leaderboardOptIn: value })} /></SettingControl>
                <SettingControl label="Anonymous name" htmlFor="anonymous-name"><input id="anonymous-name" aria-label="Anonymous name" value={settings.privacy.anonymousName} maxLength={48} onChange={(event) => updateSection("privacy", { anonymousName: event.target.value })} className={controlClassName} /></SettingControl>
                <SettingControl label="Ranked mode" description="Placeholder for future verified play." htmlFor="ranked-mode"><Toggle id="ranked-mode" label="Ranked mode" checked={settings.privacy.rankedMode} onChange={(value) => updateSection("privacy", { rankedMode: value })} /></SettingControl>
              </div>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}
