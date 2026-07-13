import { describe, expect, it } from "vitest";

import { createRng } from "@/domain/random/rng";

describe("createRng", () => {
  it("produces the same sequence from the same seed, across separate constructions", () => {
    const first = createRng("determinism-check");
    const second = createRng("determinism-check");

    const firstDraws = Array.from({ length: 1000 }, () => first.next());
    const secondDraws = Array.from({ length: 1000 }, () => second.next());

    expect(firstDraws).toEqual(secondDraws);
  });

  it("diverges quickly on different seeds", () => {
    const a = createRng("seed-a");
    const b = createRng("seed-b");

    const aDraws = [a.next(), a.next(), a.next()];
    const bDraws = [b.next(), b.next(), b.next()];

    expect(aDraws).not.toEqual(bDraws);
  });

  it("stays in [0, 1)", () => {
    const rng = createRng("range-check");

    for (let draw = 0; draw < 1000; draw += 1) {
      const value = rng.next();

      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });

  describe("int", () => {
    it("is inclusive at both ends", () => {
      const rng = createRng("int-bounds");
      const seen = new Set<number>();

      for (let draw = 0; draw < 1000; draw += 1) {
        const value = rng.int(0, 3);

        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThanOrEqual(3);
        seen.add(value);
      }

      // Over a thousand draws, missing any of four values means the bounds are wrong.
      expect(seen).toEqual(new Set([0, 1, 2, 3]));
    });

    it("returns the only possible value when the bounds meet", () => {
      const rng = createRng("int-single");

      expect(rng.int(7, 7)).toBe(7);
    });

    it("rejects reversed and non-integer bounds", () => {
      const rng = createRng("int-invalid");

      expect(() => rng.int(3, 1)).toThrow();
      expect(() => rng.int(0.5, 2)).toThrow();
    });
  });

  describe("pick", () => {
    it("never returns undefined from a non-empty array", () => {
      const rng = createRng("pick-check");
      const items = ["a", "b", "c"];

      for (let draw = 0; draw < 200; draw += 1) {
        expect(items).toContain(rng.pick(items));
      }
    });

    it("throws on an empty array", () => {
      const rng = createRng("pick-empty");

      expect(() => rng.pick([])).toThrow();
    });
  });

  describe("shuffle", () => {
    it("returns a permutation and leaves the input untouched", () => {
      const rng = createRng("shuffle-check");
      const items = [1, 2, 3, 4, 5, 6, 7, 8];
      const shuffled = rng.shuffle(items);

      expect(items).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
      expect([...shuffled].sort((a, b) => a - b)).toEqual(items);
    });

    it("actually reorders across seeds", () => {
      const items = Array.from({ length: 10 }, (_, index) => index);
      const orders = new Set(
        Array.from({ length: 20 }, (_, seed) =>
          createRng(`shuffle-${seed}`).shuffle(items).join(","),
        ),
      );

      expect(orders.size).toBeGreaterThan(1);
    });
  });

  describe("bool", () => {
    it("respects certain and impossible probabilities", () => {
      const rng = createRng("bool-check");

      for (let draw = 0; draw < 50; draw += 1) {
        expect(rng.bool(1)).toBe(true);
        expect(rng.bool(0)).toBe(false);
      }
    });
  });

  describe("fork", () => {
    it("is unaffected by how many draws the parent has made", () => {
      const drained = createRng("fork-check");

      for (let draw = 0; draw < 100; draw += 1) {
        drained.next();
      }

      const fromDrained = drained.fork("child");
      const fromFresh = createRng("fork-check").fork("child");

      const drainedDraws = Array.from({ length: 100 }, () => fromDrained.next());
      const freshDraws = Array.from({ length: 100 }, () => fromFresh.next());

      expect(drainedDraws).toEqual(freshDraws);
    });

    it("gives the same stream for the same label and different streams for different labels", () => {
      const rng = createRng("fork-labels");

      expect(rng.fork("a").next()).toBe(rng.fork("a").next());
      expect(rng.fork("a").next()).not.toBe(rng.fork("b").next());
    });
  });
});
