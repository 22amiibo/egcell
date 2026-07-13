import type { DifficultyPreset } from "@/domain/challenges/difficulty";
import type {
  ColumnRole,
  DatasetShape,
  DatasetTheme,
  GeneratedGrid,
  ThemeColumn,
} from "@/domain/datasets/datasetTypes";
import type { CellValue, GridCell, GridState } from "@/domain/grid/gridTypes";
import { cellKey, columnLabel } from "@/domain/grid/range";
import type { Rng } from "@/domain/random/rng";

/** Padding keeps the table from filling the viewport edge to edge, like the classic grid. */
const ROW_PADDING = 4;
const COL_PADDING = 3;
const MS_PER_DAY = 86_400_000;
/** All generated dates land in this year, far from any clock. */
const DATE_EPOCH_UTC = Date.UTC(2026, 0, 1);

/**
 * Draws a concrete shape from a difficulty preset's bands. Templates call this with a forked
 * stream, then hand the result to `generateDataset`.
 */
export function shapeFromPreset(
  rng: Rng,
  preset: DifficultyPreset,
  base: Pick<DatasetShape, "requiredRoles"> & Partial<DatasetShape>,
): DatasetShape {
  const distractorCols = base.distractorCols ?? rng.int(...preset.distractorColumns);
  const totalCols = Math.max(
    base.totalCols ?? rng.int(...preset.cols),
    base.requiredRoles.length + distractorCols,
  );

  return {
    rows: base.rows ?? rng.int(...preset.rows),
    requiredRoles: base.requiredRoles,
    totalCols,
    distractorCols,
    confusables: base.confusables ?? preset.confusables,
    blankInRole: base.blankInRole,
    tableOffset: base.tableOffset ?? preset.tableOffset,
    unformattedRoles: base.unformattedRoles,
    boldHeaders: base.boldHeaders,
  };
}

type PlacedColumn = {
  header: string;
  source: ThemeColumn;
  /** Primary columns are targetable through columnsByRole; distractors are not. */
  primary: boolean;
  unformatted: boolean;
};

function themeColumn(theme: DatasetTheme, role: ColumnRole): ThemeColumn {
  const column = theme.columns.find((candidate) => candidate.role === role);

  if (column === undefined) {
    throw new Error(`Theme ${theme.id} has no ${role} column.`);
  }

  return column;
}

/** ISO date string for a deterministic day offset. Never reads the clock. */
function isoDate(dayOffset: number): string {
  return new Date(DATE_EPOCH_UTC + dayOffset * MS_PER_DAY).toISOString().slice(0, 10);
}

function drawValue(rng: Rng, column: ThemeColumn, rowIndex: number, names: string[]): CellValue {
  switch (column.role) {
    case "name":
      return { kind: "text", value: names[rowIndex] };

    case "date":
      return { kind: "date", iso: isoDate(rng.int(0, 359)) };

    case "rate": {
      const [min, max] = column.range ?? [5, 95];

      // Stored as a ratio with two decimals, so percent formatting reads as a whole percent.
      return { kind: "number", value: rng.int(min, max) / 100 };
    }

    case "amount":
    case "count": {
      const [min, max] = column.range ?? [1, 1000];

      return { kind: "number", value: rng.int(min, max) };
    }

    default:
      return { kind: "text", value: rng.pick(column.values ?? ["—"]) };
  }
}

/**
 * Builds a real spreadsheet from a theme, a shape, and a seeded stream, and reports the layout it
 * chose. Every draw comes from a named fork keyed by stable labels (mostly headers), so adding a
 * column to a theme cannot shift the values another column gets.
 */
export function generateDataset(rng: Rng, theme: DatasetTheme, shape: DatasetShape): GeneratedGrid {
  const layout = rng.fork("layout");

  // Which columns exist: required roles first, then optional roles up to the budget.
  const primaryBudget = Math.max(shape.totalCols - shape.distractorCols, shape.requiredRoles.length);
  const required = shape.requiredRoles.map((role) => themeColumn(theme, role));
  const optional = layout
    .fork("optional")
    .shuffle(
      theme.columns.filter(
        (column) => !shape.requiredRoles.includes(column.role) && column.role !== "note",
      ),
    )
    .slice(0, Math.max(primaryBudget - required.length, 0));

  const unformatted = new Set(shape.unformattedRoles ?? []);
  const placed: PlacedColumn[] = [...required, ...optional].map((source) => ({
    header: source.header,
    source,
    primary: true,
    unformatted: unformatted.has(source.role),
  }));

  // Distractors: confusable twins of placed columns when allowed, note columns otherwise.
  const twinCandidates = layout
    .fork("twins")
    .shuffle(placed.filter((column) => column.source.confusable !== undefined));
  const noteSource = theme.columns.find((column) => column.role === "note");
  let noteCount = 0;

  for (let index = 0; index < shape.distractorCols; index += 1) {
    const twin = shape.confusables ? twinCandidates[index] : undefined;

    if (twin !== undefined) {
      placed.push({
        header: twin.source.confusable as string,
        source: twin.source,
        primary: false,
        unformatted: twin.unformatted,
      });
    } else if (noteSource !== undefined) {
      noteCount += 1;
      placed.push({
        header: noteCount === 1 ? noteSource.header : `${noteSource.header} ${noteCount}`,
        source: noteSource,
        primary: false,
        unformatted: false,
      });
    }
  }

  const ordered = layout.fork("order").shuffle(placed);

  // Where the table sits.
  const headerRow = shape.tableOffset ? layout.fork("offset").int(1, 2) : 0;
  const firstCol = shape.tableOffset ? layout.fork("offset-col").int(1, 2) : 0;
  const firstDataRow = headerRow + 1;
  const lastDataRow = headerRow + shape.rows;
  const lastCol = firstCol + ordered.length - 1;

  // Names are sampled without replacement so a byName target is unique by construction.
  const nameSource = theme.columns.find((column) => column.role === "name");
  const namePool = rng.fork("names").shuffle(nameSource?.values ?? []);
  const names = Array.from(
    { length: shape.rows },
    (_, index) => namePool[index % Math.max(namePool.length, 1)] ?? `Name ${index + 1}`,
  );

  const cells: Record<string, GridCell> = {};
  const columnsByRole: GeneratedGrid["columnsByRole"] = {};
  const headersByCol: Record<number, string> = {};
  const distractorCols: number[] = [];

  ordered.forEach((column, orderIndex) => {
    const col = firstCol + orderIndex;
    const values = rng.fork(`values/${column.header}`);

    headersByCol[col] = column.header;

    if (column.primary && columnsByRole[column.source.role] === undefined) {
      columnsByRole[column.source.role] = col;
    }

    if (!column.primary) {
      distractorCols.push(col);
    }

    cells[cellKey({ row: headerRow, col })] = {
      address: { row: headerRow, col },
      value: { kind: "text", value: column.header },
      format: { bold: shape.boldHeaders ?? true },
    };

    const seen = new Set<number>();

    for (let rowIndex = 0; rowIndex < shape.rows; rowIndex += 1) {
      const row = firstDataRow + rowIndex;
      let value = drawValue(values, column.source, rowIndex, names);

      // Numeric columns redraw duplicates a few times so sorting them is a real change.
      let retry = 0;

      while (retry < 5 && value.kind === "number" && seen.has(value.value)) {
        value = drawValue(values, column.source, rowIndex, names);
        retry += 1;
      }

      if (value.kind === "number") {
        seen.add(value.value);
      }

      const format =
        column.source.numberFormat !== undefined && !column.unformatted
          ? { numberFormat: column.source.numberFormat }
          : {};

      cells[cellKey({ row, col })] = { address: { row, col }, value, format };
    }
  });

  // Categorical columns used by filters must not be uniform, or "filter to X" means "do nothing".
  for (const role of ["category", "status"] as const) {
    const col = columnsByRole[role];

    if (col === undefined || shape.rows < 2) {
      continue;
    }

    const pool = themeColumn(theme, role).values ?? [];
    const first = cells[cellKey({ row: firstDataRow, col })]?.value;
    const uniform = Array.from({ length: shape.rows }, (_, index) =>
      cells[cellKey({ row: firstDataRow + index, col })],
    ).every((cell) => {
      const value = cell?.value;

      return value?.kind === "text" && first?.kind === "text" && value.value === first.value;
    });

    if (uniform && first?.kind === "text") {
      const replacement = pool.find((value) => value !== first.value);

      if (replacement !== undefined) {
        const address = { row: firstDataRow + 1, col };

        cells[cellKey(address)] = {
          address,
          value: { kind: "text", value: replacement },
          format: cells[cellKey(address)]?.format ?? {},
        };
      }
    }
  }

  // Punch the requested blank: the cell is absent, exactly like untouched grid space.
  const blanksByCol: Record<number, number[]> = {};
  const blankCol = shape.blankInRole !== undefined ? columnsByRole[shape.blankInRole] : undefined;

  if (blankCol !== undefined && shape.rows >= 3) {
    const blankRow = rng.fork("blanks").int(firstDataRow + 1, lastDataRow - 1);

    delete cells[cellKey({ row: blankRow, col: blankCol })];
    blanksByCol[blankCol] = [blankRow];
  }

  const rowCount = lastDataRow + 1 + ROW_PADDING;
  const colCount = lastCol + 1 + COL_PADDING;

  const grid: GridState = {
    rowCount,
    colCount,
    usedRange: {
      start: { row: headerRow, col: firstCol },
      end: { row: lastDataRow, col: lastCol },
    },
    headerRows: 1,
    columns: Array.from({ length: colCount }, (_, col) => columnLabel(col)),
    rows: Array.from({ length: rowCount }, (_, row) => row + 1),
    cells,
    activeCell: { row: 0, col: 0 },
    selection: { kind: "none" },
    hiddenRows: [],
    sortState: null,
    filters: [],
  };

  return {
    grid,
    themeId: theme.id,
    columnsByRole,
    headersByCol,
    headerRow,
    firstDataRow,
    lastDataRow,
    firstCol,
    lastCol,
    distractorCols,
    blanksByCol,
  };
}
