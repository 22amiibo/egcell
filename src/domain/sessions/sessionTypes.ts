/**
 * A session is a run of several challenges under one clock: a sprint of a fixed number of tasks,
 * or a timed mode where tasks keep coming until the clock runs out. Single-challenge play does not
 * go through any of this.
 */
export type SessionMode = "sprint-5" | "sprint-10" | "timed-30" | "timed-60";

export type SessionPlan =
  | { kind: "task-count"; taskCount: number }
  | { kind: "fixed-time"; durationSeconds: number };

export const SESSION_MODES: SessionMode[] = ["sprint-5", "sprint-10", "timed-30", "timed-60"];

export const SESSION_PLANS: Record<SessionMode, SessionPlan> = {
  "sprint-5": { kind: "task-count", taskCount: 5 },
  "sprint-10": { kind: "task-count", taskCount: 10 },
  "timed-30": { kind: "fixed-time", durationSeconds: 30 },
  "timed-60": { kind: "fixed-time", durationSeconds: 60 },
};

export function sessionModeLabel(mode: SessionMode): string {
  switch (mode) {
    case "sprint-5":
      return "Sprint 5";
    case "sprint-10":
      return "Sprint 10";
    case "timed-30":
      return "30 seconds";
    case "timed-60":
      return "60 seconds";
  }
}

/**
 * How one task inside a session ended. `skipped` is the player moving on; `expired` is the session
 * clock running out mid-task. Both still carry whatever partial credit the validator awarded.
 */
export type TaskOutcome = "completed" | "skipped" | "expired";

export type SessionTaskResult = {
  challengeId: string;
  challengeVersion: string;
  title: string;
  outcome: TaskOutcome;
  elapsedMs: number;
  score: number;
  correctness: number;
  completionPercent: number;
  accuracy: number;
};

export type SessionResult = {
  mode: SessionMode;
  /** The sum of every task's score, so an unfinished or skipped task simply pays less. */
  totalScore: number;
  totalElapsedMs: number;
  tasksCompleted: number;
  /** Sprint: the planned length. Timed: how many tasks were actually put in front of the player. */
  taskCount: number;
  /** Mean task completion over `taskCount`, so a skipped sprint task drags the average down. */
  completionPercent: number;
  accuracy: number;
  /** ISO 8601. */
  finishedAt: string;
  tasks: SessionTaskResult[];
};
