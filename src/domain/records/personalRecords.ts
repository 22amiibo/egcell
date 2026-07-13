import type { Challenge, ChallengeMode } from "@/domain/challenges/challengeTypes";
import type { PersonalRecord, PersonalRecordStore } from "@/domain/records/recordTypes";
import type { JsonStorage } from "@/lib/storage";

export const PERSONAL_RECORDS_KEY = "excel-speed-trainer:v1:personal-records";

export function recordKey(challengeId: string, mode: ChallengeMode): string {
  return `${challengeId}:${mode}`;
}

/** Only a finished run that clears the challenge's correctness floor can bank a record. */
export function isPersonalRecordEligible(
  challenge: Challenge,
  result: { isComplete: boolean; correctness: number },
): boolean {
  return result.isComplete && result.correctness >= challenge.scoring.minimumCorrectnessForPr;
}

/**
 * Higher score wins. A tied score is broken by the faster time. A tie on both keeps the incumbent,
 * so an identical replay does not churn the `achievedAt` stamp.
 */
export function betterRecord(
  existing: PersonalRecord | undefined,
  candidate: PersonalRecord,
): PersonalRecord {
  if (existing === undefined) {
    return candidate;
  }

  if (candidate.bestScore > existing.bestScore) {
    return candidate;
  }

  if (candidate.bestScore === existing.bestScore) {
    return candidate.bestElapsedMs < existing.bestElapsedMs ? candidate : existing;
  }

  return existing;
}

export function updatePersonalRecords(
  store: PersonalRecordStore,
  candidate: PersonalRecord,
): PersonalRecordStore {
  const key = recordKey(candidate.challengeId, candidate.mode);

  return { ...store, [key]: betterRecord(store[key], candidate) };
}

function isPersonalRecord(value: unknown): value is PersonalRecord {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as Partial<PersonalRecord>;

  return (
    typeof candidate.challengeId === "string" &&
    (candidate.mode === "main-speed" || candidate.mode === "practice") &&
    typeof candidate.bestScore === "number" &&
    typeof candidate.bestElapsedMs === "number" &&
    typeof candidate.bestCorrectness === "number" &&
    typeof candidate.achievedAt === "string" &&
    typeof candidate.seed === "string"
  );
}

/**
 * Whatever the browser hands back is untrusted: it may come from an older build, a hand edit, or a
 * half-finished write. Entries that do not look like records are dropped instead of crashing the game.
 */
export function readPersonalRecords(storage: JsonStorage): PersonalRecordStore {
  const raw = storage.read<unknown>(PERSONAL_RECORDS_KEY, {});

  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    return {};
  }

  const store: PersonalRecordStore = {};

  for (const [key, value] of Object.entries(raw)) {
    if (isPersonalRecord(value)) {
      store[key] = value;
    }
  }

  return store;
}

export function writePersonalRecords(storage: JsonStorage, store: PersonalRecordStore): void {
  storage.write(PERSONAL_RECORDS_KEY, store);
}
