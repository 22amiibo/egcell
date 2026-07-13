type TaskProgressRailProps = {
  currentTask: number;
  completedTasks: number;
  totalTasks: number | null;
};

/** Compact session progress that reserves its full width before task counts change. */
export function TaskProgressRail({
  currentTask,
  completedTasks,
  totalTasks,
}: TaskProgressRailProps) {
  const max = totalTasks ?? Math.max(currentTask, 1);
  const value = Math.min(Math.max(completedTasks, 0), max);

  return (
    <div
      data-testid="task-progress-rail"
      className="flex min-w-44 flex-col items-end gap-1"
    >
      <span className="text-[11px] font-medium tabular-nums text-muted uppercase">
        {totalTasks === null ? `Task ${currentTask}` : `Task ${currentTask} / ${totalTasks}`}
      </span>
      <div
        role="progressbar"
        aria-label="Session progress"
        aria-valuemin={0}
        aria-valuemax={max}
        aria-valuenow={value}
        className="h-1.5 w-44 overflow-hidden rounded-full bg-surface-raised"
      >
        <span
          aria-hidden
          className="block h-full rounded-full bg-accent transition-[width] duration-[var(--motion-fast)]"
          style={{ width: `${max === 0 ? 0 : (value / max) * 100}%` }}
        />
      </div>
    </div>
  );
}
