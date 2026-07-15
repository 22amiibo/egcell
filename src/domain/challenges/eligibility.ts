import type { LeafValidationSpec } from "@/domain/challenges/challengeTypes";
import { SPEC_KIND_ACTIONS } from "@/domain/challenges/templateRegistry";
import type { ChallengeVariant, EligibilityIssue } from "@/domain/challenges/variantTypes";
import type { GeneratedGrid } from "@/domain/datasets/datasetTypes";
import { matchesFilter } from "@/domain/grid/cellValues";
import type { CellFormat, GridState, RangeAddress } from "@/domain/grid/gridTypes";
import { cellKey, isAddressInRange, normalizeRange, rangesEqual } from "@/domain/grid/range";
import { dataRowBounds, getCell } from "@/domain/grid/selectors";
import type { RunState } from "@/domain/runs/runTypes";
import { validateChallenge } from "@/domain/validation/validateChallenge";

export type EligibilityInput = {
  variant: ChallengeVariant;
  /** The layout the generator chose. Prompt and data checks need it; fixed variants omit it. */
  dataset?: GeneratedGrid;
};

function leafSpecs(variant: ChallengeVariant): LeafValidationSpec[] {
  return variant.validation.kind === "composite" ? variant.validation.parts : [variant.validation];
}

function inGrid(grid: GridState, range: RangeAddress): boolean {
  const { start, end } = normalizeRange(range);

  return (
    start.row >= 0 && start.col >= 0 && end.row < grid.rowCount && end.col < grid.colCount
  );
}

/** The columns a spec actually grades. The prompt may name these and nothing else. */
function specTargetCols(spec: LeafValidationSpec): number[] {
  switch (spec.kind) {
    case "navigation":
      return [spec.requiredCell.col];

    case "selection": {
      const { start, end } = normalizeRange(spec.requiredRange);

      return Array.from({ length: end.col - start.col + 1 }, (_, index) => start.col + index);
    }

    case "formatting": {
      const { start, end } = normalizeRange(spec.range);

      return Array.from({ length: end.col - start.col + 1 }, (_, index) => start.col + index);
    }

    case "sort-filter": {
      const cols: number[] = [];

      if (spec.requiredSort !== undefined) {
        cols.push(spec.requiredSort.col);
      }

      if (spec.requiredVisible !== undefined) {
        cols.push(spec.requiredVisible.col);
      }

      return cols;
    }

    case "cell-value":
    case "formula":
      return [spec.cell.col];
  }
}

/**
 * The dataset headers the prompt mentions, matched longest-first so "Revenue" inside a prompt is
 * never mistaken for the "Revenue LY" twin, and vice versa.
 */
function headerColsInPrompt(prompt: string, dataset: GeneratedGrid): number[] {
  const entries = Object.entries(dataset.headersByCol).sort(
    ([, a], [, b]) => b.length - a.length,
  );
  const claimed: Array<[number, number]> = [];
  const found: number[] = [];

  for (const [col, header] of entries) {
    let searchFrom = 0;

    while (searchFrom <= prompt.length - header.length) {
      const at = prompt.indexOf(header, searchFrom);

      if (at === -1) {
        break;
      }

      const overlaps = claimed.some(([start, end]) => at < end && at + header.length > start);

      if (!overlaps) {
        claimed.push([at, at + header.length]);
        found.push(Number(col));
        break;
      }

      searchFrom = at + 1;
    }
  }

  return found;
}

function cellSatisfies(grid: GridState, row: number, col: number, required: CellFormat): boolean {
  const format = getCell(grid, { row, col })?.format ?? {};

  return (Object.keys(required) as Array<keyof CellFormat>).every(
    (key) => format[key] === required[key],
  );
}

function rangesOverlap(left: RangeAddress, right: RangeAddress): boolean {
  const first = normalizeRange(left);
  const second = normalizeRange(right);

  return (
    isAddressInRange(first.start, second) ||
    isAddressInRange(first.end, second) ||
    isAddressInRange(second.start, first) ||
    isAddressInRange(second.end, first)
  );
}

function formatsConflict(left: CellFormat, right: CellFormat): boolean {
  return (Object.keys(left) as Array<keyof CellFormat>).some(
    (key) => right[key] !== undefined && right[key] !== left[key],
  );
}

/**
 * Composite parts all grade the same final grid. Reject pairs whose requirements cannot coexist,
 * rather than shipping a chain that can never earn full credit regardless of route.
 */
function conflictingCompositeParts(left: LeafValidationSpec, right: LeafValidationSpec): boolean {
  if (left.kind === "selection" && right.kind === "selection") {
    return !rangesEqual(left.requiredRange, right.requiredRange);
  }

  if (left.kind === "navigation" && right.kind === "navigation") {
    return (
      left.requiredCell.row !== right.requiredCell.row || left.requiredCell.col !== right.requiredCell.col
    );
  }

  return (
    left.kind === "formatting" &&
    right.kind === "formatting" &&
    rangesOverlap(left.range, right.range) &&
    formatsConflict(left.requiredFormat, right.requiredFormat)
  );
}

function syntheticRun(variant: ChallengeVariant): RunState {
  return {
    challengeId: variant.id,
    challengeVersion: variant.version,
    seed: variant.seed,
    mode: "main-speed",
    status: "running",
    startedAt: 0,
    finishedAt: null,
    elapsedMs: 0,
    events: [],
  };
}

/**
 * Every check a variant must pass before a player may see it. A variant with any issue is
 * re-drawn, never shipped: this is a gate, not a warning. These are the registry test's
 * guarantees, promoted from a suite over 23 literals to a check over every generated draw.
 */
export function checkVariant(input: EligibilityInput): EligibilityIssue[] {
  const issues: EligibilityIssue[] = [];
  const { variant, dataset } = input;
  const grid = variant.initialGrid;
  const specs = leafSpecs(variant);

  // Composites stay flat and simple: at most one sort/filter part, because two filters grade as
  // an intersection neither part's predicate describes.
  if (variant.validation.kind === "composite") {
    const sortFilterParts = specs.filter((spec) => spec.kind === "sort-filter").length;

    if (
      variant.validation.partLabels !== undefined &&
      variant.validation.partLabels.length !== specs.length
    ) {
      issues.push({
        check: "composite-label-count",
        detail: `${variant.validation.partLabels.length} labels cannot describe ${specs.length} parts.`,
      });
    }

    if (sortFilterParts > 1) {
      issues.push({
        check: "composite-multiple-sort-filter",
        detail: `${sortFilterParts} sort-filter parts cannot be graded independently.`,
      });
    }

    for (let leftIndex = 0; leftIndex < specs.length; leftIndex += 1) {
      for (let rightIndex = leftIndex + 1; rightIndex < specs.length; rightIndex += 1) {
        if (conflictingCompositeParts(specs[leftIndex], specs[rightIndex])) {
          issues.push({
            check: "composite-interference",
            detail: `Parts ${leftIndex + 1} and ${rightIndex + 1} require incompatible final grid state.`,
          });
        }
      }
    }
  }

  for (const spec of specs) {
    // Every target must lie inside the grid, or the challenge can never be completed.
    switch (spec.kind) {
      case "navigation": {
        const cell = spec.requiredCell;

        if (!inGrid(grid, { start: cell, end: cell })) {
          issues.push({ check: "target-outside-grid", detail: `Cell ${cellKey(cell)} is off-grid.` });
        }

        break;
      }

      case "selection":
        if (!inGrid(grid, spec.requiredRange)) {
          issues.push({ check: "target-outside-grid", detail: "Selection range is off-grid." });
        }

        break;

      case "formatting":
        if (!inGrid(grid, spec.range)) {
          issues.push({ check: "target-outside-grid", detail: "Formatting range is off-grid." });
        }

        break;

      case "sort-filter":
        for (const col of specTargetCols(spec)) {
          if (col < 0 || col >= grid.colCount) {
            issues.push({ check: "target-outside-grid", detail: `Column ${col} is off-grid.` });
          }
        }

        break;

      case "cell-value":
      case "formula":
        if (!inGrid(grid, { start: spec.cell, end: spec.cell })) {
          issues.push({
            check: "target-outside-grid",
            detail: `Cell ${cellKey(spec.cell)} is off-grid.`,
          });
        }

        break;
    }

    // The toolbar and keyboard hide actions a challenge does not allow, so a spec whose actions
    // are all missing would have no route to completion.
    if (!SPEC_KIND_ACTIONS[spec.kind].some((action) => variant.allowedActions.includes(action))) {
      issues.push({
        check: "actions-missing",
        detail: `No allowed action can satisfy a ${spec.kind} spec.`,
      });
    }

    // A sort target whose values are all equal is satisfied by any order.
    if (spec.kind === "sort-filter" && spec.requiredSort !== undefined) {
      const { first, last } = dataRowBounds(grid);
      const distinct = new Set<string>();

      for (let row = first; row <= last; row += 1) {
        const value = getCell(grid, { row, col: spec.requiredSort.col })?.value;

        distinct.add(JSON.stringify(value ?? null));
      }

      if (distinct.size < 2) {
        issues.push({
          check: "sort-uniform",
          detail: "The sort column holds fewer than two distinct values.",
        });
      }
    }

    // A filter that matches nothing, or everything, asks the player to do nothing.
    if (spec.kind === "sort-filter" && spec.requiredVisible !== undefined) {
      const { first, last } = dataRowBounds(grid);
      const predicate = spec.requiredVisible;
      let matches = 0;
      let rows = 0;

      for (let row = first; row <= last; row += 1) {
        rows += 1;

        const value = getCell(grid, { row, col: predicate.col })?.value;

        if (matchesFilter(value, { col: predicate.col, op: predicate.op, value: predicate.value })) {
          matches += 1;
        }
      }

      if (matches === 0 || matches === rows) {
        issues.push({
          check: "filter-trivial",
          detail: `The filter matches ${matches} of ${rows} rows.`,
        });
      }
    }

    // No formatting target may start already satisfying the requirement, per cell: the classic
    // "starts complete" bug, caught before the mean can hide it.
    if (spec.kind === "formatting") {
      const { start, end } = normalizeRange(spec.range);

      for (let row = start.row; row <= end.row; row += 1) {
        for (let col = start.col; col <= end.col; col += 1) {
          if (cellSatisfies(grid, row, col, spec.requiredFormat)) {
            issues.push({
              check: "format-already-satisfied",
              detail: `Cell ${cellKey({ row, col })} already carries the required format.`,
            });
            row = end.row + 1;
            break;
          }
        }
      }
    }
  }

  // The untouched grid must not satisfy the validator.
  const result = validateChallenge({ challenge: variant, grid, run: syntheticRun(variant) });

  if (result.isComplete) {
    issues.push({ check: "starts-complete", detail: "The initial grid already passes validation." });
  }

  // Prompt checks need the generator's layout.
  if (dataset !== undefined) {
    const promptCols = headerColsInPrompt(variant.prompt, dataset);
    const targetCols = new Set(specs.flatMap(specTargetCols));

    // The prompt may not name a column the spec does not grade: that is misdirection, and it is
    // also how a stale prompt survives a layout change.
    for (const col of promptCols) {
      if (!targetCols.has(col)) {
        issues.push({
          check: "prompt-misdirection",
          detail: `The prompt names ${dataset.headersByCol[col]}, which the validator ignores.`,
        });
      }
    }

    // A role-targeted template must name its target's header, re-derived from the prompt text.
    // This is the check that keeps a prompt and its validator from ever disagreeing.
    const { targetRole, targetLabel } = variant.dimensions;

    if (targetRole !== undefined) {
      const roleCol = dataset.columnsByRole[targetRole];

      if (roleCol === undefined) {
        issues.push({
          check: "target-role-missing",
          detail: `The dataset placed no ${targetRole} column.`,
        });
      } else if (!promptCols.includes(roleCol)) {
        issues.push({
          check: "prompt-target-mismatch",
          detail: `The prompt does not name ${dataset.headersByCol[roleCol]}.`,
        });
      }
    }

    // A byName target must be unique in the name column.
    if (targetLabel !== undefined) {
      const nameCol = dataset.columnsByRole.name;
      let occurrences = 0;

      if (nameCol !== undefined) {
        for (let row = dataset.firstDataRow; row <= dataset.lastDataRow; row += 1) {
          const value = getCell(grid, { row, col: nameCol })?.value;

          if (value?.kind === "text" && value.value === targetLabel) {
            occurrences += 1;
          }
        }
      }

      if (occurrences !== 1) {
        issues.push({
          check: "by-name-ambiguous",
          detail: `${targetLabel} appears ${occurrences} times in the name column.`,
        });
      }
    }
  }

  return issues;
}
