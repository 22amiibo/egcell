"use client";

import { useCallback, useState, useSyncExternalStore } from "react";

import {
  ascentRecordKey,
  isNewAscentRecord,
  readAscentRecords,
  updateAscentRecords,
  writeAscentRecords,
  type AscentRecord,
  type AscentRecordStore,
} from "@/domain/records/ascentRecords";
import { createLocalJsonStorage } from "@/lib/storage";

export type AscentRecordSubmission = {
  previousBest: AscentRecord | undefined;
  currentBest: AscentRecord;
  isNewRecord: boolean;
};

export type LocalAscentRecords = {
  records: AscentRecordStore;
  getBest: (durationSeconds: number) => AscentRecord | undefined;
  submit: (candidate: AscentRecord) => AscentRecordSubmission;
};

/** Stable identity. A snapshot that returned a fresh object each call would loop forever. */
const EMPTY_STORE: AscentRecordStore = {};

/**
 * Same shape as the session record store: `localStorage` read through `useSyncExternalStore`,
 * empty on the server, real records after hydration.
 *
 * One instance must be shared by everything that shows Ascent records. Two instances would each
 * hold their own snapshot, and a record banked through one would not appear in the other until a
 * reload.
 */
function createAscentRecordsStore() {
  const storage = createLocalJsonStorage();
  const listeners = new Set<() => void>();

  let snapshot: AscentRecordStore | null = null;

  const getSnapshot = (): AscentRecordStore => {
    snapshot ??= readAscentRecords(storage);

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

    getServerSnapshot(): AscentRecordStore {
      return EMPTY_STORE;
    },

    submit(candidate: AscentRecord): AscentRecordSubmission {
      const current = getSnapshot();
      const key = ascentRecordKey(candidate.durationSeconds);
      const previousBest = current[key];
      const next = updateAscentRecords(current, candidate);

      snapshot = next;
      writeAscentRecords(storage, next);
      listeners.forEach((listener) => listener());

      const currentBest = next[key] as AscentRecord;

      // Not `currentBest === candidate`: the independent `bestPeakTier` merge means
      // `updateAscentRecords` returns a freshly spread object on every submit past a duration's
      // first-ever run, so that identity check would never fire again. `isNewAscentRecord`
      // recomputes the same score-then-tasks tie-break value-wise instead.
      return { previousBest, currentBest, isNewRecord: isNewAscentRecord(previousBest, candidate) };
    },
  };
}

export function useLocalAscentRecords(): LocalAscentRecords {
  const [store] = useState(createAscentRecordsStore);

  const records = useSyncExternalStore(
    store.subscribe,
    store.getSnapshot,
    store.getServerSnapshot,
  );

  const getBest = useCallback(
    (durationSeconds: number) => records[ascentRecordKey(durationSeconds)],
    [records],
  );

  const submit = useCallback((candidate: AscentRecord) => store.submit(candidate), [store]);

  return { records, getBest, submit };
}
