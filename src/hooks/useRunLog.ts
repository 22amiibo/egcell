"use client";

import { useCallback, useState, useSyncExternalStore } from "react";

import { appendRun, emptyLog, readRunLog, writeRunLog, type RunLog } from "@/domain/runs/runLog";
import { stampRunRecord, type NewRunRecord } from "@/domain/runs/runRecord";
import { createLocalJsonStorage } from "@/lib/storage";

export type LocalRunLog = {
  log: RunLog;
  record: (entry: NewRunRecord) => void;
};

/** Stable identity for the server snapshot, as in every other store here. */
const EMPTY_LOG: RunLog = emptyLog();

function createRunLogStore() {
  const storage = createLocalJsonStorage();
  const listeners = new Set<() => void>();

  let snapshot: RunLog | null = null;

  const getSnapshot = (): RunLog => {
    // The first read is also the migration: `readRunLog` converts the v1 history when the log key
    // is absent, leaving v1 on disk as the backup (§9.5). It happens once, lazily, on the client.
    snapshot ??= readRunLog(storage);

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

    getServerSnapshot(): RunLog {
      return EMPTY_LOG;
    },

    record(entry: NewRunRecord): void {
      const atMs = Date.now();
      // Unique enough for a local list: the moment plus a random suffix. The scheme v1 used.
      const id = `${atMs.toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
      const next = appendRun(getSnapshot(), stampRunRecord(entry, atMs, id));

      snapshot = next;
      writeRunLog(storage, next);
      listeners.forEach((listener) => listener());
    },
  };
}

/**
 * The one store every finished run lands in, and the one the profile reads. Replaces
 * `useLocalRunHistory` at both ends; the v1 profile it migrates from stays on disk, untouched,
 * until Phase 10 retires it.
 */
export function useRunLog(): LocalRunLog {
  const [store] = useState(createRunLogStore);

  const log = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getServerSnapshot);

  const record = useCallback((entry: NewRunRecord) => store.record(entry), [store]);

  return { log, record };
}
