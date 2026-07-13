/**
 * The wall clock is an external system, so runs read it through `useSyncExternalStore`.
 *
 * The clock starts when the surface appears, not on the first click. Were it to start on the first
 * action, a correct first click would always land at roughly zero elapsed time, pinning the speed
 * multiplier at its cap on every run and flattening the score into a constant. Sessions use the
 * same clock for the same reason, one level up: the session clock starts when the first task's
 * grid appears.
 *
 * The server snapshot is null because `Date.now()` on the server and in the browser would disagree
 * and break hydration. The first read in the browser is what starts the run.
 */
export function createRunClock() {
  const listeners = new Set<() => void>();

  let startedAt: number | null = null;

  return {
    subscribe(listener: () => void) {
      listeners.add(listener);

      return () => {
        listeners.delete(listener);
      };
    },

    getSnapshot(): number | null {
      startedAt ??= Date.now();

      return startedAt;
    },

    getServerSnapshot(): number | null {
      return null;
    },

    /** The start time the scorer measures against. Identical to what the timer displays. */
    startedAt(): number {
      startedAt ??= Date.now();

      return startedAt;
    },

    restart(): void {
      startedAt = Date.now();
      listeners.forEach((listener) => listener());
    },
  };
}

export type RunClock = ReturnType<typeof createRunClock>;
