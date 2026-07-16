import type { GridCommandId } from "@/domain/commands/commandTypes";
import type { RunEvent } from "@/domain/runs/runTypes";
import type { JsonStorage } from "@/lib/storage";

export const COMMAND_STATS_KEY = "excel-speed-trainer:v1:command-stats";

export type CommandStat = {
  uses: number;
  /**
   * Exponentially weighted mean of the gap (ms) since the previous event, for the events that fired
   * this command. Null only when the measurement that would have set it had no preceding event to
   * gap against — in practice, only the very first event of a run.
   */
  ewmaGapMs: number | null;
  /** ISO 8601. */
  lastUsedAt: string;
};

export type CommandStatsStore = Partial<Record<GridCommandId, CommandStat>>;

const EWMA_ALPHA = 0.2;

/**
 * Folds one run's events in. The gap attributed to a command is the time since the previous
 * event — a rough but honest "time to fire". Counts and one number per command: the store stays
 * bounded no matter how much is played.
 */
export function foldCommandStats(
  store: CommandStatsStore,
  events: RunEvent[],
  atIso: string,
): CommandStatsStore {
  const next: CommandStatsStore = { ...store };
  let previousAtMs: number | null = null;

  for (const event of events) {
    const command = event.command;

    if (command === undefined) {
      previousAtMs = event.atMs;
      continue;
    }

    const gap = previousAtMs === null ? null : event.atMs - previousAtMs;
    const existing = next[command];

    next[command] = {
      uses: (existing?.uses ?? 0) + 1,
      ewmaGapMs:
        gap === null
          ? (existing?.ewmaGapMs ?? null)
          : existing?.ewmaGapMs == null
            ? gap
            : existing.ewmaGapMs * (1 - EWMA_ALPHA) + gap * EWMA_ALPHA,
      lastUsedAt: atIso,
    };
    previousAtMs = event.atMs;
  }

  return next;
}

export type CommandMasteryLevel = "unknown" | "seen" | "learned" | "fluent" | "reflex";

export const COMMAND_MASTERY_THRESHOLDS = {
  learned: 15,
  fluent: 40,
  reflex: 80,
  fluentGapMs: 2500,
  reflexGapMs: 1200,
} as const;

export function commandMasteryLevel(stat: CommandStat | undefined): CommandMasteryLevel {
  if (stat === undefined || stat.uses === 0) {
    return "unknown";
  }

  const gap = stat.ewmaGapMs ?? Number.POSITIVE_INFINITY;

  if (stat.uses >= COMMAND_MASTERY_THRESHOLDS.reflex && gap < COMMAND_MASTERY_THRESHOLDS.reflexGapMs) {
    return "reflex";
  }

  if (stat.uses >= COMMAND_MASTERY_THRESHOLDS.fluent && gap < COMMAND_MASTERY_THRESHOLDS.fluentGapMs) {
    return "fluent";
  }

  if (stat.uses >= COMMAND_MASTERY_THRESHOLDS.learned) {
    return "learned";
  }

  return "seen";
}

export function readCommandStats(storage: JsonStorage): CommandStatsStore {
  const raw = storage.read<unknown>(COMMAND_STATS_KEY, {});

  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    return {};
  }

  const store: CommandStatsStore = {};

  for (const [key, value] of Object.entries(raw)) {
    const candidate = value as Partial<CommandStat>;

    if (
      typeof candidate?.uses === "number" &&
      (candidate.ewmaGapMs === null || typeof candidate.ewmaGapMs === "number") &&
      typeof candidate.lastUsedAt === "string"
    ) {
      store[key as GridCommandId] = candidate as CommandStat;
    }
  }

  return store;
}

export function writeCommandStats(storage: JsonStorage, store: CommandStatsStore): void {
  storage.write(COMMAND_STATS_KEY, store);
}
