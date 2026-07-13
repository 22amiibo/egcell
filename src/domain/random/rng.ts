/**
 * Deterministic seeded randomness for challenge generation.
 *
 * Same seed string, same sequence, on every machine and every run. Generation code must draw all
 * of its randomness from an `Rng` handed to it — never from `Math.random` or the clock — or two
 * players on the same seed would face different challenges.
 */
export type Rng = {
  /** Uniform in [0, 1). */
  next(): number;
  /** Uniform integer, inclusive at both ends. */
  int(minInclusive: number, maxInclusive: number): number;
  /** One item, uniformly. Throws on an empty array rather than returning undefined. */
  pick<T>(items: readonly T[]): T;
  /** A shuffled copy; the input is untouched. */
  shuffle<T>(items: readonly T[]): T[];
  /** True with the given probability, 0.5 by default. */
  bool(probability?: number): boolean;
  /**
   * An independent stream derived from this Rng's seed and a label, unaffected by how many draws
   * the parent has made. Named forks are what keep old seeds stable: adding a draw to one
   * generation stage cannot shift the numbers another stage sees.
   */
  fork(label: string): Rng;
};

/** FNV-1a, 32-bit. Spreads short human-readable seeds across the full integer range. */
function hashSeed(seed: string): number {
  let hash = 0x811c9dc5;

  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }

  return hash >>> 0;
}

/** mulberry32: tiny, fast, and statistically fine for game content. Not cryptographic. */
function mulberry32(seedNumber: number): () => number {
  let state = seedNumber >>> 0;

  return () => {
    state = (state + 0x6d2b79f5) >>> 0;

    let t = state;

    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);

    return ((t ^ (t >>> 14)) >>> 0) / 0x100000000;
  };
}

export function createRng(seed: string): Rng {
  const next = mulberry32(hashSeed(seed));

  const int = (minInclusive: number, maxInclusive: number): number => {
    if (!Number.isInteger(minInclusive) || !Number.isInteger(maxInclusive)) {
      throw new Error(`int() needs integer bounds, got ${minInclusive}..${maxInclusive}.`);
    }

    if (minInclusive > maxInclusive) {
      throw new Error(`int() bounds are reversed: ${minInclusive} > ${maxInclusive}.`);
    }

    return minInclusive + Math.floor(next() * (maxInclusive - minInclusive + 1));
  };

  const pick = <T>(items: readonly T[]): T => {
    if (items.length === 0) {
      throw new Error("pick() was handed an empty array.");
    }

    return items[int(0, items.length - 1)];
  };

  const shuffle = <T>(items: readonly T[]): T[] => {
    const result = [...items];

    // Fisher-Yates, drawing from this stream.
    for (let index = result.length - 1; index > 0; index -= 1) {
      const swap = int(0, index);

      [result[index], result[swap]] = [result[swap], result[index]];
    }

    return result;
  };

  const bool = (probability = 0.5): boolean => next() < probability;

  const fork = (label: string): Rng => createRng(`${seed}/${label}`);

  return { next, int, pick, shuffle, bool, fork };
}
