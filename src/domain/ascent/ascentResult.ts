import type { AscentRecord } from "@/domain/records/ascentRecords";

/**
 * The shape one finished Ascent climb assembles into: banked as an `AscentRecord` and appended to
 * the run log as a `RunRecord` (`runRecordForAscent`, `src/domain/runs/runRecord.ts`).
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

/**
 * The book only remembers the run that won — `updateAscentRecords`/`isNewAscentRecord` do the
 * comparing (`ascentRecords.ts`). `peakTierAtBest` and `bestPeakTier` both start out equal to this
 * run's own peak; they only diverge once a *later* run's merge pulls the independent
 * `bestPeakTier` high-water mark ahead of the run that actually holds the score record.
 */
export function ascentRecordFromResult(result: AscentResult): AscentRecord {
  return {
    durationSeconds: result.durationSeconds,
    bestScore: result.totalScore,
    peakTierAtBest: result.peakTier,
    bestTasksCompleted: result.tasksCompleted,
    bestPeakTier: result.peakTier,
    achievedAt: result.finishedAt,
  };
}
