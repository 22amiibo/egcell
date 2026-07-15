/**
 * The shape one finished Ascent climb assembles into: banked as an `AscentRecord` and appended to
 * the run log as a `RunRecord` (`runRecordForAscent`, `src/domain/runs/runRecord.ts`). This file
 * holds only the type for now — Task 4.4 adds the assembly and banking functions here.
 */
export type AscentResult = {
  durationSeconds: number;
  totalScore: number;
  tasksCompleted: number;
  peakTier: number;
  overdriveRungs: number;
  wpm: number | null;
  keystrokeAccuracy: number | null;
  /** ISO 8601. */
  finishedAt: string;
};
