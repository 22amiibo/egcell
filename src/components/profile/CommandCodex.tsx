import { COMMAND_REGISTRY } from "@/domain/commands/commandRegistry";
import type { GridCommandId } from "@/domain/commands/commandTypes";
import { commandChordLabel } from "@/domain/commands/keymap";
import { commandMasteryLevel, type CommandStatsStore } from "@/domain/mastery/commandMastery";
import { getPlatform, type Platform } from "@/lib/platform";

type CommandGroupLabel =
  | "Movement"
  | "Jump"
  | "Extend"
  | "Select"
  | "Format"
  | "Sort & Filter"
  | "Edit"
  | "Pointer";

/**
 * The brief's 7 workflow groups (Movement/Jump/Extend/Select/Format/Sort & Filter/Edit) do not cover
 * four pointer-synthetic ids (`CLICK_CELL`, `DRAG_SELECT_RANGE`, `CLICK_COLUMN_HEADER`,
 * `CLICK_ROW_HEADER`) — never searched by the route solver, but still real registry entries a
 * cheat-sheet cannot silently drop. "Pointer" is the 8th group that catches them.
 *
 * Exhaustive by type, like `DESCRIPTIONS` in `commandRegistry.ts`: a `Record` keyed by every
 * `GridCommandId` cannot compile with a command missing, and an object literal cannot repeat a key,
 * so a future command either gets a group here or the build breaks — it never just vanishes from the
 * Codex. Keys are written in the exact order the Codex renders groups and commands within them
 * (verified against §5.3's controller decision); `sectionsOf` below reads that order back out.
 */
const COMMAND_GROUP: Record<GridCommandId, CommandGroupLabel> = {
  // Movement
  MOVE_UP: "Movement",
  MOVE_DOWN: "Movement",
  MOVE_LEFT: "Movement",
  MOVE_RIGHT: "Movement",

  // Jump
  JUMP_UP: "Jump",
  JUMP_DOWN: "Jump",
  JUMP_LEFT: "Jump",
  JUMP_RIGHT: "Jump",

  // Extend
  EXTEND_UP: "Extend",
  EXTEND_DOWN: "Extend",
  EXTEND_LEFT: "Extend",
  EXTEND_RIGHT: "Extend",
  EXTEND_JUMP_UP: "Extend",
  EXTEND_JUMP_DOWN: "Extend",
  EXTEND_JUMP_LEFT: "Extend",
  EXTEND_JUMP_RIGHT: "Extend",

  // Select
  SELECT_COLUMN: "Select",
  SELECT_ROW: "Select",
  SELECT_TABLE: "Select",

  // Format
  TOGGLE_BOLD: "Format",
  FORMAT_CURRENCY: "Format",
  FORMAT_PERCENT: "Format",
  FORMAT_DATE: "Format",
  APPLY_BOLD: "Format",

  // Sort & Filter
  OPEN_FILTER_MENU: "Sort & Filter",
  SORT_ASC: "Sort & Filter",
  SORT_DESC: "Sort & Filter",
  FILTER_TO_VALUE: "Sort & Filter",
  FILTER_ABOVE_VALUE: "Sort & Filter",
  CLEAR_FILTERS: "Sort & Filter",
  TOGGLE_FILTER: "Sort & Filter",

  // Edit
  START_EDIT: "Edit",
  COMMIT_EDIT: "Edit",
  CANCEL_EDIT: "Edit",

  // Pointer
  CLICK_CELL: "Pointer",
  DRAG_SELECT_RANGE: "Pointer",
  CLICK_COLUMN_HEADER: "Pointer",
  CLICK_ROW_HEADER: "Pointer",
};

type CodexSection = { label: CommandGroupLabel; ids: GridCommandId[] };

/**
 * Buckets `COMMAND_GROUP`'s keys into ordered sections, one per group, first-seen order — so the
 * rendered order follows straight from how the map above is written, with no second ordering list
 * to keep in sync with it.
 */
function sectionsOf(commandGroup: Record<GridCommandId, CommandGroupLabel>): CodexSection[] {
  const sections: CodexSection[] = [];
  const indexByLabel = new Map<CommandGroupLabel, number>();

  for (const id of Object.keys(commandGroup) as GridCommandId[]) {
    const label = commandGroup[id];
    let index = indexByLabel.get(label);

    if (index === undefined) {
      index = sections.length;
      indexByLabel.set(label, index);
      sections.push({ label, ids: [] });
    }

    sections[index].ids.push(id);
  }

  return sections;
}

const CODEX_SECTIONS: CodexSection[] = sectionsOf(COMMAND_GROUP);

/** Matches `MasteryPanel`'s own `levelLabel` idiom: the domain's lowercase level, capitalized. */
const levelLabel = (level: string): string => level.charAt(0).toUpperCase() + level.slice(1);

function CommandRow({
  id,
  platform,
  stats,
}: {
  id: GridCommandId;
  platform: Platform;
  stats: CommandStatsStore;
}) {
  // The dash is keyed on the resolved chord string being null, never on `label === null` directly —
  // a filter-menu command has `label: null` in the registry yet still resolves to a two-step chord
  // through `commandChordLabel`'s fallback.
  const chord = commandChordLabel(id, platform) ?? "—";
  const level = commandMasteryLevel(stats[id]);

  return (
    <tr className="border-b border-line/60 last:border-0" data-testid="command-row">
      <td className="px-3 py-2 text-ink">{COMMAND_REGISTRY[id].description}</td>
      <td className="px-3 py-2 whitespace-nowrap" data-testid={`command-chord-${id}`}>
        <kbd className="rounded border border-line px-1.5 py-0.5 font-mono text-[11px] text-muted">
          {chord}
        </kbd>
      </td>
      <td
        className="px-3 py-2 text-right whitespace-nowrap text-muted"
        data-testid={`command-mastery-${id}`}
      >
        {levelLabel(level)}
      </td>
    </tr>
  );
}

/**
 * The Command Codex (§5.3): the game's first global keyboard cheat sheet and a per-command mastery
 * ladder in one screen. Every registry command renders here, with or without a stat behind it —
 * this is not a "your progress" view alone, it is also the reference a player checks between runs to
 * learn a shortcut they have never used yet, which is why an absent stat reads "Unknown" rather than
 * being omitted.
 */
export function CommandCodex({
  stats,
  platform = getPlatform(),
}: {
  stats: CommandStatsStore;
  platform?: Platform;
}) {
  return (
    <section className="flex flex-col gap-4" data-testid="command-codex">
      <h2 className="text-[13px] font-semibold text-ink">Command Codex</h2>

      {CODEX_SECTIONS.map((section) => (
        <div key={section.label} className="flex flex-col gap-2">
          <h3 className="text-[11px] font-semibold uppercase tracking-wide text-muted">
            {section.label}
          </h3>

          <div className="overflow-x-auto rounded-lg border border-line">
            <table className="w-full border-collapse text-left text-[12px]">
              <thead className="text-[11px] uppercase tracking-wide text-muted">
                <tr className="border-b border-line">
                  <th className="px-3 py-2 font-medium">Command</th>
                  <th className="px-3 py-2 font-medium">Shortcut</th>
                  <th className="px-3 py-2 text-right font-medium">Mastery</th>
                </tr>
              </thead>

              <tbody>
                {section.ids.map((id) => (
                  <CommandRow key={id} id={id} platform={platform} stats={stats} />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </section>
  );
}
