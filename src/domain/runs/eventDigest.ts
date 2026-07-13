import type { CellFormat, GridAction } from "@/domain/grid/gridTypes";
import type { RunEvent } from "@/domain/runs/runTypes";

const DIGEST_VERSION = "v2";

const FNV_OFFSET_BASIS = 0x811c9dc5;
const FNV_PRIME = 0x01000193;

/** Keys are sorted, so two identical formats never hash differently because of key order. */
function canonicalFormat(format: CellFormat): string {
  return Object.entries(format)
    .filter(([, value]) => value !== undefined)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${String(value)}`)
    .join(",");
}

function canonicalAction(action: GridAction): string {
  switch (action.kind) {
    case "select-cell":
      return `select-cell:${action.cell.row},${action.cell.col}`;
    case "select-range":
      return `select-range:${action.range.start.row},${action.range.start.col}-${action.range.end.row},${action.range.end.col}`;
    case "select-row":
      return `select-row:${action.row}`;
    case "select-column":
      return `select-column:${action.col}:${action.usedRangeOnly}`;
    case "set-format":
      return `set-format:${action.range.start.row},${action.range.start.col}-${action.range.end.row},${action.range.end.col}:${canonicalFormat(action.format)}`;
    case "sort-column":
      return `sort-column:${action.col}:${action.direction}`;
    case "filter-column":
      return `filter-column:${action.col}:${action.op}:${String(action.value)}`;
    case "clear-filters":
      return "clear-filters";
  }
}

/**
 * The command is part of the canonical form: two routes that reach the same action (twelve
 * `MOVE_DOWN`s and one `EXTEND_JUMP_DOWN`) are different runs, and a digest that only hashed the
 * resulting actions would say they were identical. Absent for events recorded before the command
 * layer existed — canonicalised as `""`, never guessed.
 */
export function canonicalEvents(events: RunEvent[]): string {
  return events
    .map((event) => `${event.atMs}|${event.command ?? ""}|${canonicalAction(event.action)}`)
    .join(";");
}

function fnv1a(input: string): number {
  let hash = FNV_OFFSET_BASIS;

  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, FNV_PRIME);
  }

  return hash >>> 0;
}

/**
 * NOT A SECURITY PRIMITIVE.
 *
 * This is computed on the client, from data the client controls, with a published algorithm and no
 * secret. Anyone can produce a digest for a run they never played. It exists so a future server can
 * spot two submissions claiming to be the same run, and so a replay can be checked against the
 * summary it arrived with. Trusting it to prove a run is genuine would be a mistake, and no
 * anti-cheat should be built on top of it.
 *
 * Real verification means re-running the deterministic validators on the server against the
 * submitted events. That is the plan. This digest is only the handle for it.
 *
 * The version prefix means a later change to the canonical form cannot be mistaken for the old one.
 */
export function eventDigest(events: RunEvent[]): string {
  return `${DIGEST_VERSION}:${fnv1a(canonicalEvents(events)).toString(16).padStart(8, "0")}`;
}
