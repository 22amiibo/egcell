"use client";

import { useCallback, useState, useSyncExternalStore } from "react";

import {
  emptyProfile,
  readProfile,
  recordRun,
  writeProfile,
  type ProfileState,
  type RunHistoryEntry,
} from "@/domain/profile/runHistory";
import { createLocalJsonStorage } from "@/lib/storage";

/** Everything but the stamps, which the hook adds at the moment of recording. */
export type NewRunEntry = Omit<RunHistoryEntry, "id" | "at">;

export type LocalRunHistory = {
  profile: ProfileState;
  record: (entry: NewRunEntry) => void;
};

/** Stable identity for the server snapshot, as in every other store here. */
const EMPTY_PROFILE: ProfileState = emptyProfile();

function createHistoryStore() {
  const storage = createLocalJsonStorage();
  const listeners = new Set<() => void>();

  let snapshot: ProfileState | null = null;

  const getSnapshot = (): ProfileState => {
    snapshot ??= readProfile(storage);

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

    getServerSnapshot(): ProfileState {
      return EMPTY_PROFILE;
    },

    record(entry: NewRunEntry): void {
      const at = new Date();
      const stamped: RunHistoryEntry = {
        ...entry,
        // Unique enough for a local list: the moment plus a random suffix.
        id: `${at.getTime().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
        at: at.toISOString(),
      };

      const next = recordRun(getSnapshot(), stamped);

      snapshot = next;
      writeProfile(storage, next);
      listeners.forEach((listener) => listener());
    },
  };
}

export function useLocalRunHistory(): LocalRunHistory {
  const [store] = useState(createHistoryStore);

  const profile = useSyncExternalStore(
    store.subscribe,
    store.getSnapshot,
    store.getServerSnapshot,
  );

  const record = useCallback((entry: NewRunEntry) => store.record(entry), [store]);

  return { profile, record };
}
