/**
 * Seeds are canonical strings: composed by these helpers and never parsed back. Code that needs a
 * seed's parts must carry them as separate values rather than splitting the string, so the string
 * format can change without anything downstream caring.
 */
export type ChallengeSeed = string;

export type SessionSeedSource = {
  /** `null` explicitly exercises the fallback; `undefined` reads the browser implementation. */
  randomUUID?: (() => string) | null;
  now?: () => number;
  random?: () => number;
};

/**
 * Creates entropy only at a browser/session boundary. Queue and challenge generation remain pure
 * once handed this opaque string. The injectable source keeps tests deterministic.
 */
export function createNewSessionSeed(source: SessionSeedSource = {}): ChallengeSeed {
  const browserRandomUUID = globalThis.crypto?.randomUUID?.bind(globalThis.crypto);
  const randomUUID = source.randomUUID === undefined ? browserRandomUUID : source.randomUUID;

  if (randomUUID !== null && randomUUID !== undefined) {
    return randomUUID();
  }

  const now = source.now ?? Date.now;
  const random = source.random ?? Math.random;

  return `session:${now().toString(36)}:${random().toString(36).slice(2)}:${random()
    .toString(36)
    .slice(2)}`;
}

/** The seed a whole session queue is built from. `run` distinguishes one attempt from the next. */
export function queueSeed(mode: string, difficulty: number, run: string): ChallengeSeed {
  return `q:${mode}:d${difficulty}:${run}`;
}

/** The seed for one task inside a queue. Derived, so one queue seed pins every task in it. */
export function taskSeed(queue: ChallengeSeed, index: number): ChallengeSeed {
  return `${queue}:t${index}`;
}

/** The future official daily challenge: one published seed per calendar date. */
export function dailySeed(isoDate: string): ChallengeSeed {
  return `daily:${isoDate}`;
}
