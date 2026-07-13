import type { ChallengeMode } from "@/domain/challenges/challengeTypes";
import type { ActionVia, GridCommandId } from "@/domain/commands/commandTypes";
import type { GridAction } from "@/domain/grid/gridTypes";

export type RunStatus = "idle" | "running" | "complete";

/**
 * "unknown" exists so a source that cannot be proven has an honest value instead of being coerced
 * into "keyboard" or "pointer" by a default — never produced by a live dispatch call site, only by
 * something reading input evidence that was never recorded.
 */
export type RunInputMethod = "keyboard" | "pointer" | "unknown";

/** One player action, stamped with milliseconds since the run started. */
export type RunEvent = {
  atMs: number;
  action: GridAction;
  /** Optional for backward-compatible replay data written before input tracking existed. */
  inputMethod?: RunInputMethod;
  /** The semantic command that produced this action. Minted at the input boundary; absent only for events recorded before the command layer existed. */
  command?: GridCommandId;
  /** Which surface carried the input: a keyboard-activated toolbar button is "keyboard" + "toolbar". */
  via?: ActionVia;
  /** Raw keyboard evidence, e.g. "mod+shift+ArrowDown". Null for non-keyboard input. */
  chord?: string | null;
  /** Raw pointer/toolbar/menu control evidence, e.g. "toolbar-bold". Null for keyboard input. */
  controlId?: string | null;
};

export type RunState = {
  challengeId: string;
  challengeVersion: string;
  seed: string;
  mode: ChallengeMode;
  status: RunStatus;
  /** Epoch milliseconds. Null until the player's first action starts the clock. */
  startedAt: number | null;
  /** Epoch milliseconds. Null until the run completes. */
  finishedAt: number | null;
  elapsedMs: number;
  events: RunEvent[];
};
