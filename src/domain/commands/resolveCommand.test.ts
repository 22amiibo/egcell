import { describe, expect, it } from "vitest";

import type { CommandContext } from "@/domain/commands/resolveCommand";
import { resolveCommand } from "@/domain/commands/resolveCommand";
import { createRevenueGrid } from "@/test/fixtures/revenueGrid";

describe("edit lifecycle commands", () => {
  const grid = createRevenueGrid();
  const context: CommandContext = {
    grid,
    focus: grid.activeCell,
    anchor: grid.activeCell,
    editBuffer: null,
  };

  it("COMMIT_EDIT resolves the buffer onto the active cell", () => {
    const action = resolveCommand("COMMIT_EDIT", { ...context, editBuffer: "42" });

    expect(action).toEqual({
      kind: "set-cell-value",
      cell: context.grid.activeCell,
      value: { kind: "number", value: 42 },
    });
  });

  it("COMMIT_EDIT without a buffer resolves to nothing", () => {
    expect(resolveCommand("COMMIT_EDIT", { ...context, editBuffer: null })).toBeNull();
  });

  it("START_EDIT and CANCEL_EDIT produce no grid action", () => {
    expect(resolveCommand("START_EDIT", context)).toBeNull();
    expect(resolveCommand("CANCEL_EDIT", context)).toBeNull();
  });
});
