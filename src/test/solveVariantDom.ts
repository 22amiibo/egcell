import { fireEvent, screen } from "@testing-library/react";

import type { Challenge, LeafValidationSpec } from "@/domain/challenges/challengeTypes";
import type { RangeAddress } from "@/domain/grid/gridTypes";
import { cellKey, columnLabel, normalizeRange } from "@/domain/grid/range";

/**
 * Drives the rendered grid the way a player would, for any generated variant. Component tests use
 * this to complete seeded session tasks without knowing in advance which drill was drawn.
 * Everything is `fireEvent`, so it also works under fake timers, where userEvent deadlocks.
 */

const cellName = (row: number, col: number) => `${columnLabel(col)}${row + 1}`;

// A string name is a full exact match in Testing Library, so "C1" can never catch "C10".
const button = (name: string) => screen.getByRole("button", { name });

function selectRange(range: RangeAddress) {
  const { start, end } = normalizeRange(range);

  if (start.row === end.row && start.col === end.col) {
    fireEvent.click(button(cellName(start.row, start.col)));

    return;
  }

  // A drag: down on one corner, enter the other with the button held, release.
  fireEvent.pointerDown(button(cellName(start.row, start.col)));
  fireEvent.pointerEnter(button(cellName(end.row, end.col)), { buttons: 1 });
  fireEvent.pointerUp(window);
}

function solvePart(challenge: Challenge, part: LeafValidationSpec) {
  switch (part.kind) {
    case "navigation":
      fireEvent.click(button(cellName(part.requiredCell.row, part.requiredCell.col)));

      return;

    case "selection":
      selectRange(part.requiredRange);

      return;

    case "formatting": {
      selectRange(part.range);

      const format = part.requiredFormat;

      if (format.bold !== undefined) {
        fireEvent.click(button("Bold"));
      }

      if (format.numberFormat === "currency") {
        fireEvent.click(button("Format as currency"));
      }

      if (format.numberFormat === "percent") {
        fireEvent.click(button("Format as percent"));
      }

      if (format.numberFormat === "date") {
        fireEvent.click(button("Format as date"));
      }

      return;
    }

    case "sort-filter": {
      const grid = challenge.initialGrid;
      const used = normalizeRange(grid.usedRange);

      if (part.requiredSort !== undefined) {
        const { col, direction } = part.requiredSort;

        fireEvent.click(button(cellName(used.start.row + grid.headerRows, col)));
        fireEvent.click(button(direction === "desc" ? "Sort high to low" : "Sort low to high"));
      }

      if (part.requiredVisible !== undefined) {
        const { col, op, value } = part.requiredVisible;

        // The toolbar filters relative to the selected cell, so find a cell holding the value.
        for (let row = used.start.row + grid.headerRows; row <= used.end.row; row += 1) {
          const cell = grid.cells[cellKey({ row, col })]?.value;
          const matches =
            (cell?.kind === "text" && cell.value === value) ||
            (cell?.kind === "number" && cell.value === value);

          if (matches) {
            fireEvent.click(button(cellName(row, col)));
            break;
          }
        }

        fireEvent.click(
          button(
            op === "greater-than" ? "Filter above the selected value" : "Filter to the selected value",
          ),
        );
      }

      return;
    }
  }
}

export function solveChallengePartDom(challenge: Challenge, partIndex: number) {
  const spec = challenge.validation;
  const parts = spec.kind === "composite" ? spec.parts : [spec];
  const part = parts[partIndex];

  if (part === undefined) {
    throw new Error(`Challenge ${challenge.id} has no part ${partIndex}.`);
  }

  solvePart(challenge, part);
}

export function solveChallengeDom(challenge: Challenge) {
  const spec = challenge.validation;
  const parts = spec.kind === "composite" ? spec.parts : [spec];

  for (const part of parts) {
    solvePart(challenge, part);
  }
}
