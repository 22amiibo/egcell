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

    setSettings(update: Settings | ((current: Settings) => Settings)): void {
      const current = getSnapshot();
      const next = typeof update === "function" ? update(current) : update;

      snapshot = next;
      writeSettings(storage, next);
      listeners.forEach((listener) => listener());
    },

    setThemeId(themeId: string): void {
      this.setSettings((current) => ({
        ...current,
        appearance: {
          ...current.appearance,
          themeId: themeById(themeId).id,
        },
      }));
    },
  };
}

/**
 * One store for the whole app, at module scope on purpose. The theme applier in the layout and
 * the picker on the settings page must share state: with per-component stores, choosing a theme
 * would not restyle the page until a reload.
 */
const settingsStore = createSettingsStore();

function subscribeToHydration(): () => void {
  return () => {};
}

function getHydratedSnapshot(): true {
  return true;
}

function getServerHydratedSnapshot(): false {
  return false;
}

export type LocalSettings = {
  settings: Settings;
  isHydrated: boolean;
  setSettings: (update: Settings | ((current: Settings) => Settings)) => void;
  setThemeId: (themeId: string) => void;
};

export function useSettings(): LocalSettings {
  const settings = useSyncExternalStore(
    settingsStore.subscribe,
    settingsStore.getSnapshot,
    settingsStore.getServerSnapshot,
  );
  const isHydrated = useSyncExternalStore(
    subscribeToHydration,
    getHydratedSnapshot,
    getServerHydratedSnapshot,
  );

  const setThemeId = useCallback((themeId: string) => settingsStore.setThemeId(themeId), []);
  const setSettings = useCallback(
    (update: Settings | ((current: Settings) => Settings)) => settingsStore.setSettings(update),
    [],
  );

  return { settings, isHydrated, setSettings, setThemeId };
}
