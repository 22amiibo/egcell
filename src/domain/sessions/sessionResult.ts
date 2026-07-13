import {
  SESSION_PLANS,
  type SessionMode,
  type SessionResult,
  type SessionTaskResult,
} from "@/domain/sessions/sessionTypes";

export type BuildSessionResultInput = {
  mode: SessionMode;
  tasks: SessionTaskResult[];
  totalElapsedMs: number;
  finishedAtMs: number;
};

export function buildSessionResult(input: BuildSessionResultInput): SessionResult {
  const plan = SESSION_PLANS[input.mode];
  const { tasks } = input;

  const tasksCompleted = tasks.filter((task) => task.outcome === "completed").length;

  // A sprint is judged against its planned length, so a skipped task drags completion down even
  // though a result row exists for it. A timed run is judged against what it actually attempted.
  const taskCount = plan.kind === "task-count" ? plan.taskCount : tasks.length;
  const denominator = Math.max(taskCount, 1);

  const completionPercent =
    tasks.reduce((sum, task) => sum + task.completionPercent, 0) / denominator;
  const accuracy =
    tasks.length === 0 ? 1 : tasks.reduce((sum, task) => sum + task.accuracy, 0) / tasks.length;
  const totalScore = tasks.reduce((sum, task) => sum + task.score, 0);

  return {
    mode: input.mode,
    totalScore,
    totalElapsedMs: input.totalElapsedMs,
    tasksCompleted,
    taskCount,
    completionPercent,
    accuracy,
    finishedAt: new Date(input.finishedAtMs).toISOString(),
    tasks,
  };
}
