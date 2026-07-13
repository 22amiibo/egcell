import { describe, expect, it } from "vitest";

import { DATASET_THEMES } from "@/data/datasets/themes";
import type { ColumnRole } from "@/domain/datasets/datasetTypes";

const ALL_ROLES: ColumnRole[] = [
  "category",
  "name",
  "amount",
  "count",
  "rate",
  "status",
  "date",
  "note",
];

describe("dataset themes", () => {
  it("ships at least the four launch themes with unique ids", () => {
    expect(DATASET_THEMES.length).toBeGreaterThanOrEqual(4);
    expect(new Set(DATASET_THEMES.map((theme) => theme.id)).size).toBe(DATASET_THEMES.length);
  });

  it.each(DATASET_THEMES.map((theme) => [theme.id, theme] as const))(
    "%s carries every role, so any template can use any theme",
    (_id, theme) => {
      const roles = new Set(theme.columns.map((column) => column.role));

      for (const role of ALL_ROLES) {
        expect(roles).toContain(role);
      }
    },
  );

  it.each(DATASET_THEMES.map((theme) => [theme.id, theme] as const))(
    "%s keeps headers unique, confusable twins included",
    (_id, theme) => {
      const headers = [
        ...theme.columns.map((column) => column.header),
        ...theme.columns.flatMap((column) =>
          column.confusable !== undefined ? [column.confusable] : [],
        ),
      ];

      expect(new Set(headers).size).toBe(headers.length);
    },
  );

  it.each(DATASET_THEMES.map((theme) => [theme.id, theme] as const))(
    "%s has pools big enough to draw from",
    (_id, theme) => {
      for (const column of theme.columns) {
        if (column.role === "name") {
          // The largest difficulty deals 24 rows; a smaller pool would repeat a byName target.
          expect(new Set(column.values).size).toBeGreaterThanOrEqual(24);
        }

        if (column.role === "category" || column.role === "status") {
          expect(new Set(column.values).size).toBeGreaterThanOrEqual(3);
        }

        if (column.range !== undefined) {
          expect(column.range[0]).toBeLessThan(column.range[1]);
          expect(Number.isInteger(column.range[0])).toBe(true);
          expect(Number.isInteger(column.range[1])).toBe(true);
        }
      }
    },
  );
});
