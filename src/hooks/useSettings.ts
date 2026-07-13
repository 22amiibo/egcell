"use client";

import { useCallback, useSyncExternalStore } from "react";

import {
  DEFAULT_SETTINGS,
  readSettings,
  themeById,
  writeSettings,
  type Settings,
} from "@/domain/settings/themes";
import { createLocalJsonStorage } from "@/lib/storage";

function createSettingsStore() {
  const storage = createLocalJsonStorage();
  const listeners = new Set<() => void>();

  let snapshot: Settings | null = null;

  const getSnapshot = (): Settings => {
    snapshot ??= readSettings(storage);

    return snapshot;
  };

  return {
    subscribe(listener: () => void) {
      listeners.add(listener);

      return () => {
        listeners.delete(listener);
      };
    },

    getSnapshot,

    getServerSnapshot(): Settings {
      return DEFAULT_SETTINGS;
    },

    setThemeId(themeId: string): void {
      const next: Settings = { themeId: themeById(themeId).id };

      snapshot = next;
      writeSettings(storage, next);
      listeners.forEach((listener) => listener());
    },
  };
}

/**
 * One store for the whole app, at module scope on purpose. The theme applier in the layout and
 * the picker on the settings page must share state: with per-component stores, choosing a theme
 * would not restyle the page until a reload.
 */
const settingsStore = createSettingsStore();

export type LocalSettings = {
  settings: Settings;
  setThemeId: (themeId: string) => void;
};

export function useSettings(): LocalSettings {
  const settings = useSyncExternalStore(
    settingsStore.subscribe,
    settingsStore.getSnapshot,
    settingsStore.getServerSnapshot,
  );

  const setThemeId = useCallback((themeId: string) => settingsStore.setThemeId(themeId), []);

  return { settings, setThemeId };
}
