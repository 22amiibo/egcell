"use client";

import { useCallback, useState, useSyncExternalStore } from "react";

import {
  foldCommandStats,
  readCommandStats,
  writeCommandStats,
  type CommandStatsStore,
} from "@/domain/mastery/commandMastery";
import type { RunEvent } from "@/domain/runs/runTypes";
import { createLocalJsonStorage } from "@/lib/storage";

export type UseCommandStats = {
  stats: CommandStatsStore;
  /**
   * Folds one run's (or one task's) events into the persisted store. Read-modify-write against
   * whatever is *currently* persisted, not a stale render snapshot: a session folds several times
   * in a row (once per task), and each fold must build on the last one's result.
   */
  fold: (events: RunEvent[]) => void;
};

/** Stable identity. A snapshot that returned a fresh object each call would loop forever. */
const EMPTY_STORE: CommandStatsStore = {};

/**
 * Same shape as the record stores, one level up: `localStorage` read through
 * `useSyncExternalStore`, empty on the server, real stats after hydration.
 *
 * One instance must be shared by everything that folds run events into command stats. Two
 * instances would each hold their own snapshot, and a fold through one would not appear in the
 * other until a reload — see `useLocalSessionRecords`, which documents the same hazard.
 */
function createCommandStatsStore() {
  const storage = createLocalJsonStorage();
  const listeners = new Set<() => void>();

  let snapshot: CommandStatsStore | null = null;

  const getSnapshot = (): CommandStatsStore => {
    snapshot ??= readCommandStats(storage);

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

    getServerSnapshot(): CommandStatsStore {
      return EMPTY_STORE;
    },

    fold(events: RunEvent[]): void {
      const current = getSnapshot();
      const next = foldCommandStats(current, events, new Date().toISOString());

      snapshot = next;
      // `writeCommandStats` goes through `createLocalJsonStorage`, whose own `write` swallows a
      // throwing/quota-full store (see storage.ts) — a lost stat must never take a run down with
      // it, so nothing here needs its own try/catch on top of that.
      writeCommandStats(storage, next);
      listeners.forEach((listener) => listener());
    },
  };
}

export function useCommandStats(): UseCommandStats {
  const [store] = useState(createCommandStatsStore);

  const stats = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getServerSnapshot);

  const fold = useCallback((events: RunEvent[]) => store.fold(events), [store]);

  return { stats, fold };
}
