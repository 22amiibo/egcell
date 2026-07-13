export type LiveRunStats = {
  elapsedMs: number;
  epm: number;
  accuracy: number;
  shortcutEfficiency: number;
  combo: number;
  mistakes: number;
  completedTasks: number;
  totalTasks: number;
  pbDeltaMs: number | null;
};

export type LiveRunStatsInput = {
  elapsedMs: number;
  actions: number;
  shortcutActions: number;
  mistakes: number;
  completedTasks: number;
  totalTasks: number;
  pbMs: number | null;
};

const nonNegative = (value: number): number =>
  Number.isFinite(value) ? Math.max(0, value) : 0;

const percent = (part: number, whole: number): number =>
  whole === 0 ? 0 : Math.round(Math.min(1, Math.max(0, part / whole)) * 100);

export function calculateLiveRunStats(input: LiveRunStatsInput): LiveRunStats {
  const elapsedMs = nonNegative(input.elapsedMs);
  const actions = nonNegative(input.actions);
  const shortcutActions = nonNegative(input.shortcutActions);
  const mistakes = nonNegative(input.mistakes);
  const completedTasks = nonNegative(input.completedTasks);
  const totalTasks = nonNegative(input.totalTasks);
  const correctActions = Math.max(actions - mistakes, 0);

  return {
    elapsedMs,
    epm: elapsedMs === 0 ? 0 : Math.round((completedTasks * 60_000) / elapsedMs),
    accuracy: actions === 0 ? 100 : percent(correctActions, actions),
    shortcutEfficiency: percent(shortcutActions, actions),
    combo: Math.max(Math.round(correctActions), 0),
    mistakes,
    completedTasks,
    totalTasks,
    pbDeltaMs:
      input.pbMs !== null && Number.isFinite(input.pbMs) && input.pbMs >= 0
        ? elapsedMs - input.pbMs
        : null,
  };
}
