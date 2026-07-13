"use client";

import { useCallback, useState, useSyncExternalStore } from "react";

import type { ChallengeMode } from "@/domain/challenges/challengeTypes";
import {
  readPersonalRecords,
  recordKey,
  updatePersonalRecords,
  writePersonalRecords,
} from "@/domain/records/personalRecords";
import type { PersonalRecord, PersonalRecordStore } from "@/domain/records/recordTypes";
import { createLocalJsonStorage } from "@/lib/storage";

export type RecordSubmission = {
  previousBest: PersonalRecord | undefined;
  currentBest: PersonalRecord;
  isNewRecord: boolean;
};

export type LocalPersonalRecords = {
  records: PersonalRecordStore;
  getBest: (challengeId: string, mode: ChallengeMode) => PersonalRecord | undefined;
  submit: (candidate: PersonalRecord) => RecordSubmission;
};

/** Stable identity. A snapshot that returned a fresh object each call would loop forever. */
const EMPTY_STORE: PersonalRecordStore = {};

/**
 * `localStorage` is an external system that does not exist during a server render, which is exactly
 * what `useSyncExternalStore` is for. The server snapshot is empty and the client snapshot is the
 * saved store, so React renders the empty state, hydrates cleanly, and then swaps in the real
 * records. Loading them in an effect instead would work but costs an extra render and trips
 * `react-hooks/set-state-in-effect`.
 */
function createRecordsStore() {
  const storage = createLocalJsonStorage();
  const listeners = new Set<() => void>();

  let snapshot: PersonalRecordStore | null = null;

  const getSnapshot = (): PersonalRecordStore => {
    snapshot ??= readPersonalRecords(storage);

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

    getServerSnapshot(): PersonalRecordStore {
      return EMPTY_STORE;
    },

    submit(candidate: PersonalRecord): RecordSubmission {
      const key = recordKey(candidate.challengeId, candidate.mode);
      const current = getSnapshot();
      const previousBest = current[key];
      const next = updatePersonalRecords(current, candidate);

      snapshot = next;
      writePersonalRecords(storage, next);
      listeners.forEach((listener) => listener());

      const currentBest = next[key];

      return { previousBest, currentBest, isNewRecord: currentBest === candidate };
    },
  };
}

export function useLocalPersonalRecords(): LocalPersonalRecords {
  const [store] = useState(createRecordsStore);

  const records = useSyncExternalStore(
    store.subscribe,
    store.getSnapshot,
    store.getServerSnapshot,
  );

  const getBest = useCallback(
    (challengeId: string, mode: ChallengeMode) => records[recordKey(challengeId, mode)],
    [records],
  );

  const submit = useCallback((candidate: PersonalRecord) => store.submit(candidate), [store]);

  return { records, getBest, submit };
}
