"use client";

import { useCallback, useState, useSyncExternalStore } from "react";

import {
  readSessionRecords,
  updateSessionRecords,
  writeSessionRecords,
  type SessionRecord,
  type SessionRecordStore,
} from "@/domain/sessions/sessionRecords";
import type { SessionMode } from "@/domain/sessions/sessionTypes";
import { createLocalJsonStorage } from "@/lib/storage";

export type SessionRecordSubmission = {
  previousBest: SessionRecord | undefined;
  currentBest: SessionRecord;
  isNewRecord: boolean;
};

export type LocalSessionRecords = {
  records: SessionRecordStore;
  getBest: (mode: SessionMode) => SessionRecord | undefined;
  submit: (candidate: SessionRecord) => SessionRecordSubmission;
};

/** Stable identity. A snapshot that returned a fresh object each call would loop forever. */
const EMPTY_STORE: SessionRecordStore = {};

/**
 * Same shape as the personal record store, one level up: `localStorage` read through
 * `useSyncExternalStore`, empty on the server, real records after hydration.
 *
 * One instance must be shared by everything that shows session records. Two instances would each
 * hold their own snapshot, and a record banked through one would not appear in the other until a
 * reload.
 */
function createSessionRecordsStore() {
  const storage = createLocalJsonStorage();
  const listeners = new Set<() => void>();

  let snapshot: SessionRecordStore | null = null;

  const getSnapshot = (): SessionRecordStore => {
    snapshot ??= readSessionRecords(storage);

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

    getServerSnapshot(): SessionRecordStore {
      return EMPTY_STORE;
    },

    submit(candidate: SessionRecord): SessionRecordSubmission {
      const current = getSnapshot();
      const previousBest = current[candidate.mode];
      const next = updateSessionRecords(current, candidate);

      snapshot = next;
      writeSessionRecords(storage, next);
      listeners.forEach((listener) => listener());

      const currentBest = next[candidate.mode] as SessionRecord;

      return { previousBest, currentBest, isNewRecord: currentBest === candidate };
    },
  };
}

export function useLocalSessionRecords(): LocalSessionRecords {
  const [store] = useState(createSessionRecordsStore);

  const records = useSyncExternalStore(
    store.subscribe,
    store.getSnapshot,
    store.getServerSnapshot,
  );

  const getBest = useCallback((mode: SessionMode) => records[mode], [records]);

  const submit = useCallback((candidate: SessionRecord) => store.submit(candidate), [store]);

  return { records, getBest, submit };
}
