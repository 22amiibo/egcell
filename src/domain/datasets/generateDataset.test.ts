import { describe, expect, it } from "vitest";

import { DATASET_THEMES } from "@/data/datasets/themes";
import { ALL_DIFFICULTIES, DIFFICULTY_PRESETS } from "@/domain/challenges/difficulty";
import type { DatasetTheme, GeneratedGrid } from "@/domain/datasets/datasetTypes";
import { generateDataset, shapeFromPreset } from "@/domain/datasets/generateDataset";
import { gridReducer } from "@/domain/grid/gridReducer";
import { cellKey, normalizeRange } from "@/domain/grid/range";
import { createRng } from "@/domain/random/rng";

function buildDataset(theme: DatasetTheme, difficulty: (typeof ALL_DIFFICULTIES)[number], seed: string) {
  const rng = createRng(seed);
  const shape = shapeFromPreset(rng.fork("shape"), DIFFICULTY_PRESETS[difficulty], {
    requiredRoles: ["category", "name", "amount", "count"],
  });

  return generateDataset(rng.fork("dataset"), theme, shape);
}

/** One string per data row: the row's values across the used columns, in order. */
function rowSignatures(dataset: GeneratedGrid): string[] {
  const signatures: string[] = [];

  for (let row = dataset.firstDataRow; row <= dataset.lastDataRow; row += 1) {
    const parts: string[] = [];

    for (let col = dataset.firstCol; col <= dataset.lastCol; col += 1) {
      const value = dataset.grid.cells[cellKey({ row, col })]?.value;

      parts.push(value === undefined ? "" : JSON.stringify(value));
    }

    signatures.push(parts.join("|"));
  }

  return signatures;
}

describe("generateDataset", () => {
  it("is deterministic: same seed, same grid, deep-equal", () => {
    const theme = DATASET_THEMES[0];

    expect(buildDataset(theme, 3, "determinism")).toEqual(buildDataset(theme, 3, "determinism"));
  });

  it("changes with the seed", () => {
    const theme = DATASET_THEMES[0];

    expect(buildDataset(theme, 3, "seed-one")).not.toEqual(buildDataset(theme, 3, "seed-two"));
  });

  // The load-bearing fuzz: 4 themes x 5 difficulties x 10 seeds = 200 generated grids, each held
  // to every invariant the engine assumes. This is what lets variants ship without a hand-written
  // test per variant.
  it("holds every grid invariant across 200 seeds", () => {
    for (const theme of DATASET_THEMES) {
      for (const difficulty of ALL_DIFFICULTIES) {
        for (let draw = 0; draw < 10; draw += 1) {
          const dataset = buildDataset(theme, difficulty, `fuzz-${theme.id}-${difficulty}-${draw}`);
          const { grid } = dataset;
          const used = normalizeRange(grid.usedRange);

          // The used range fits the grid.
          expect(used.start.row).toBeGreaterThanOrEqual(0);
          expect(used.start.col).toBeGreaterThanOrEqual(0);
          expect(used.end.row).toBeLessThan(grid.rowCount);
          expect(used.end.col).toBeLessThan(grid.colCount);

          // No cell lies outside the used range.
          for (const cell of Object.values(grid.cells)) {
            expect(cell.address.row).toBeGreaterThanOrEqual(used.start.row);
            expect(cell.address.row).toBeLessThanOrEqual(used.end.row);
            expect(cell.address.col).toBeGreaterThanOrEqual(used.start.col);
            expect(cell.address.col).toBeLessThanOrEqual(used.end.col);
          }

          // Headers exist, are unique, and match what headersByCol reports.
          const headers = Object.entries(dataset.headersByCol);

          expect(headers.length).toBe(dataset.lastCol - dataset.firstCol + 1);
          expect(new Set(headers.map(([, header]) => header)).size).toBe(headers.length);

          for (const [col, header] of headers) {
            const cell = grid.cells[cellKey({ row: dataset.headerRow, col: Number(col) })];

            expect(cell?.value).toEqual({ kind: "text", value: header });
          }

          // Every reported role points at a real column.
          for (const col of Object.values(dataset.columnsByRole)) {
            expect(col).toBeGreaterThanOrEqual(dataset.firstCol);
            expect(col).toBeLessThanOrEqual(dataset.lastCol);
          }

          // Names are unique, so a byName target has exactly one answer.
          const nameCol = dataset.columnsByRole.name;

          if (nameCol !== undefined) {
            const names: string[] = [];

            for (let row = dataset.firstDataRow; row <= dataset.lastDataRow; row += 1) {
              const value = grid.cells[cellKey({ row, col: nameCol })]?.value;

              if (value?.kind === "text") {
                names.push(value.value);
              }
            }

            expect(new Set(names).size).toBe(names.length);
          }

          // A category column used for filtering is never uniform.
          const categoryCol = dataset.columnsByRole.category;

          if (categoryCol !== undefined) {
            const values = new Set<string>();

            for (let row = dataset.firstDataRow; row <= dataset.lastDataRow; row += 1) {
              const value = grid.cells[cellKey({ row, col: categoryCol })]?.value;

              if (value?.kind === "text") {
                values.add(value.value);
              }
            }

            expect(values.size).toBeGreaterThanOrEqual(2);
          }

          // A sortable numeric column has at least two distinct values.
          const amountCol = dataset.columnsByRole.amount;

          if (amountCol !== undefined) {
            const values = new Set<number>();

            for (let row = dataset.firstDataRow; row <= dataset.lastDataRow; row += 1) {
              const value = grid.cells[cellKey({ row, col: amountCol })]?.value;

              if (value?.kind === "number") {
                values.add(value.value);
              }
            }

            expect(values.size).toBeGreaterThanOrEqual(2);
          }

          // The engine can sort and filter the generated grid: the header stays put and whole
          // rows travel together.
          if (amountCol !== undefined) {
            const before = new Set(rowSignatures(dataset));
            const sorted = gridReducer(grid, {
              kind: "sort-column",
              col: amountCol,
              direction: "desc",
            });

            expect(sorted.cells[cellKey({ row: dataset.headerRow, col: amountCol })]).toEqual(
              grid.cells[cellKey({ row: dataset.headerRow, col: amountCol })],
            );

            const after = new Set(rowSignatures({ ...dataset, grid: sorted }));

            expect(after).toEqual(before);
          }

          if (categoryCol !== undefined) {
            const firstCategory = grid.cells[cellKey({ row: dataset.firstDataRow, col: categoryCol })]
              ?.value;

            if (firstCategory?.kind === "text") {
              const filtered = gridReducer(grid, {
                kind: "filter-column",
                col: categoryCol,
                op: "equals",
                value: firstCategory.value,
              });

              expect(filtered.hiddenRows).not.toContain(dataset.headerRow);
              expect(filtered.hiddenRows.length).toBeLessThan(
                dataset.lastDataRow - dataset.firstDataRow + 1,
              );
            }
          }
        }
      }
    }
  });

  it("punches a single findable blank when asked", () => {
    const theme = DATASET_THEMES[1];
    const rng = createRng("blank-check");
    const shape = shapeFromPreset(rng.fork("shape"), DIFFICULTY_PRESETS[2], {
      requiredRoles: ["category", "name", "amount", "count"],
      blankInRole: "amount",
    });
    const dataset = generateDataset(rng.fork("dataset"), theme, shape);
    const amountCol = dataset.columnsByRole.amount;

    expect(amountCol).toBeDefined();

    const blanks = dataset.blanksByCol[amountCol as number];

    expect(blanks).toHaveLength(1);
    expect(blanks[0]).toBeGreaterThan(dataset.firstDataRow);
    expect(blanks[0]).toBeLessThan(dataset.lastDataRow);
    expect(dataset.grid.cells[cellKey({ row: blanks[0], col: amountCol as number })]).toBeUndefined();
  });

  it("strips formats and header bolding when the shape says so", () => {
    const theme = DATASET_THEMES[0];
    const rng = createRng("strip-check");
    const shape = shapeFromPreset(rng.fork("shape"), DIFFICULTY_PRESETS[1], {
      requiredRoles: ["category", "name", "amount", "count"],
      unformattedRoles: ["amount"],
      boldHeaders: false,
    });
    const dataset = generateDataset(rng.fork("dataset"), theme, shape);
    const amountCol = dataset.columnsByRole.amount as number;

    for (let row = dataset.firstDataRow; row <= dataset.lastDataRow; row += 1) {
      expect(dataset.grid.cells[cellKey({ row, col: amountCol })]?.format.numberFormat).toBeUndefined();
    }

    for (let col = dataset.firstCol; col <= dataset.lastCol; col += 1) {
      expect(dataset.grid.cells[cellKey({ row: dataset.headerRow, col })]?.format.bold).toBe(false);
    }
  });

  it("offsets the table away from A1 when the shape allows it", () => {
    const theme = DATASET_THEMES[2];
    const rng = createRng("offset-check");
    const shape = shapeFromPreset(rng.fork("shape"), DIFFICULTY_PRESETS[5], {
      requiredRoles: ["category", "name", "amount", "count"],
      tableOffset: true,
    });
    const dataset = generateDataset(rng.fork("dataset"), theme, shape);

    expect(dataset.headerRow).toBeGreaterThanOrEqual(1);
    expect(dataset.firstCol).toBeGreaterThanOrEqual(1);
  });
});
