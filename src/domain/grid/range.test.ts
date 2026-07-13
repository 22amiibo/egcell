import { describe, expect, it } from "vitest";

import {
  cellKey,
  columnLabel,
  isAddressInRange,
  normalizeRange,
  rangeCellCount,
  rangesEqual,
} from "@/domain/grid/range";

describe("normalizeRange", () => {
  it("returns sorted start/end coordinates for a fully inverted range", () => {
    expect(normalizeRange({ start: { row: 6, col: 4 }, end: { row: 0, col: 2 } })).toEqual({
      start: { row: 0, col: 2 },
      end: { row: 6, col: 4 },
    });
  });

  it("leaves an already sorted range unchanged", () => {
    expect(normalizeRange({ start: { row: 0, col: 2 }, end: { row: 6, col: 2 } })).toEqual({
      start: { row: 0, col: 2 },
      end: { row: 6, col: 2 },
    });
  });

  it("normalizes each axis independently", () => {
    expect(normalizeRange({ start: { row: 1, col: 5 }, end: { row: 4, col: 2 } })).toEqual({
      start: { row: 1, col: 2 },
      end: { row: 4, col: 5 },
    });
  });

  it("does not mutate the input range", () => {
    const input = { start: { row: 6, col: 4 }, end: { row: 0, col: 2 } };

    normalizeRange(input);

    expect(input).toEqual({ start: { row: 6, col: 4 }, end: { row: 0, col: 2 } });
  });
});

describe("rangesEqual", () => {
  it("treats an inverted range as equal to its normalized form", () => {
    const normalized = { start: { row: 0, col: 2 }, end: { row: 6, col: 2 } };
    const inverted = { start: { row: 6, col: 2 }, end: { row: 0, col: 2 } };

    expect(rangesEqual(normalized, inverted)).toBe(true);
  });

  it("returns false when the ranges cover different cells", () => {
    const revenueColumn = { start: { row: 0, col: 2 }, end: { row: 6, col: 2 } };
    const unitsColumn = { start: { row: 0, col: 3 }, end: { row: 6, col: 3 } };

    expect(rangesEqual(revenueColumn, unitsColumn)).toBe(false);
  });

  it("returns false when one range is a subset of the other", () => {
    const wholeColumn = { start: { row: 0, col: 2 }, end: { row: 6, col: 2 } };
    const dataOnly = { start: { row: 1, col: 2 }, end: { row: 6, col: 2 } };

    expect(rangesEqual(wholeColumn, dataOnly)).toBe(false);
  });
});

describe("isAddressInRange", () => {
  const revenueColumn = { start: { row: 0, col: 2 }, end: { row: 6, col: 2 } };

  it("includes the range boundaries", () => {
    expect(isAddressInRange({ row: 0, col: 2 }, revenueColumn)).toBe(true);
    expect(isAddressInRange({ row: 6, col: 2 }, revenueColumn)).toBe(true);
  });

  it("excludes addresses outside the range", () => {
    expect(isAddressInRange({ row: 7, col: 2 }, revenueColumn)).toBe(false);
    expect(isAddressInRange({ row: 3, col: 3 }, revenueColumn)).toBe(false);
  });

  it("works with an inverted range", () => {
    const inverted = { start: { row: 6, col: 2 }, end: { row: 0, col: 2 } };

    expect(isAddressInRange({ row: 3, col: 2 }, inverted)).toBe(true);
  });
});

describe("rangeCellCount", () => {
  it("counts a single cell", () => {
    expect(rangeCellCount({ start: { row: 2, col: 2 }, end: { row: 2, col: 2 } })).toBe(1);
  });

  it("counts a column of the used range", () => {
    expect(rangeCellCount({ start: { row: 0, col: 2 }, end: { row: 6, col: 2 } })).toBe(7);
  });

  it("counts a rectangular block", () => {
    expect(rangeCellCount({ start: { row: 0, col: 0 }, end: { row: 6, col: 4 } })).toBe(35);
  });
});

describe("cellKey", () => {
  it("builds a stable key from an address", () => {
    expect(cellKey({ row: 0, col: 2 })).toBe("0:2");
  });

  it("does not collide across transposed addresses", () => {
    expect(cellKey({ row: 1, col: 2 })).not.toBe(cellKey({ row: 2, col: 1 }));
  });
});

describe("columnLabel", () => {
  it("maps the first 26 indexes to A through Z", () => {
    expect(columnLabel(0)).toBe("A");
    expect(columnLabel(2)).toBe("C");
    expect(columnLabel(25)).toBe("Z");
  });

  it("rolls over to two letters after Z", () => {
    expect(columnLabel(26)).toBe("AA");
    expect(columnLabel(27)).toBe("AB");
    expect(columnLabel(51)).toBe("AZ");
    expect(columnLabel(52)).toBe("BA");
  });
});
