import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ChallengeRun } from "@/components/game/ChallengeRun";
import { challenges } from "@/data/challenges";
import type { Challenge } from "@/domain/challenges/challengeTypes";
import type { GridCommandId } from "@/domain/commands/commandTypes";
import { getRoutes } from "@/domain/routes/routeCache";
import type { Route } from "@/domain/routes/routeTypes";
import { DEFAULT_SETTINGS, type HotkeyStrictness, type Settings } from "@/domain/settings/themes";
import type { LocalPersonalRecords } from "@/hooks/useLocalPersonalRecords";

const settings = vi.hoisted(() => ({ current: null as unknown as Settings }));

vi.mock("@/hooks/useSettings", () => ({
  useSettings: () => ({ settings: settings.current, updateSection: vi.fn(), reset: vi.fn() }),
}));

const KEYS: Partial<Record<GridCommandId, { key: string; ctrlKey?: boolean }>> = {
  MOVE_UP: { key: "ArrowUp" },
  MOVE_DOWN: { key: "ArrowDown" },
  MOVE_LEFT: { key: "ArrowLeft" },
  MOVE_RIGHT: { key: "ArrowRight" },
  JUMP_UP: { key: "ArrowUp", ctrlKey: true },
  JUMP_DOWN: { key: "ArrowDown", ctrlKey: true },
  JUMP_LEFT: { key: "ArrowLeft", ctrlKey: true },
  JUMP_RIGHT: { key: "ArrowRight", ctrlKey: true },
};

/** A drill whose whole route is arrows, so a complete keyboard-only run fits inside a test. */
const challenge: Challenge = challenges.find(
  (candidate) =>
    candidate.validation.kind === "navigation" &&
    ((getRoutes(candidate) as Route[] | null)?.[0].steps ?? []).every(
      (step) => KEYS[step.command] !== undefined,
    ),
)!;

/** `submit` must return a real submission: `useGameRun` reads `previousBest` straight off it. */
function records(
  submit: ReturnType<typeof vi.fn> = vi.fn(),
): { store: LocalPersonalRecords; submit: ReturnType<typeof vi.fn> } {
  submit.mockReturnValue({ previousBest: undefined, isNewRecord: true });

  return {
    store: { records: {}, getBest: () => undefined, submit } as unknown as LocalPersonalRecords,
    submit,
  };
}

function withStrictness(strictness: HotkeyStrictness): void {
  settings.current = {
    ...DEFAULT_SETTINGS,
    scoring: { ...DEFAULT_SETTINGS.scoring, hotkeyStrictness: strictness },
  };
}

function solveWithKeys(): void {
  const grid = screen.getByRole("grid");

  for (const step of (getRoutes(challenge) as Route[])[0].steps) {
    fireEvent.keyDown(grid, KEYS[step.command]);
  }
}

/**
 * A real mouse click — `detail: 1` is what separates it from a keyboard activation — on the cell the
 * run already starts from. It taints the run without moving the cursor, so the keyboard route that
 * follows still solves the drill: the only thing under test here is the *pointer*, not the route.
 */
function clickACell(): void {
  fireEvent.click(screen.getByRole("button", { name: "A1" }), { detail: 1 });
}

beforeEach(() => {
  settings.current = DEFAULT_SETTINGS;
});

describe("Hotkey Mode", () => {
  it("tells the player what the drill is worth before they start", () => {
    // The optimal count is a property of the challenge, not of the player, so showing it up front
    // gives nothing away: it is the objective, not the answer (§7.4).
    render(
      <ChallengeRun challenge={challenge} mode="hotkey" records={records().store} onNext={vi.fn()} />,
    );

    expect(screen.getByTestId("hotkey-objective")).toHaveTextContent(/Keyboard only · \d+ optimal/);
  });

  it("banks a Hotkey record for a keyboard-only run", async () => {
    const submit = vi.fn();

    withStrictness("strict");
    render(
      <ChallengeRun
        challenge={challenge}
        mode="hotkey"
        records={records(submit).store}
        onNext={vi.fn()}
      />,
    );

    solveWithKeys();

    expect(await screen.findByTestId("result-card")).toBeVisible();
    expect(submit).toHaveBeenCalledWith(expect.objectContaining({ mode: "hotkey" }));
  });

  it("banks nothing for the same run with one click in it, at strict", async () => {
    // The run still completes, still scores, and still lands in the log. Purity is a rule about the
    // record book, never about grading (§6.2) — the player finished the drill, and the card says so.
    const submit = vi.fn();

    withStrictness("strict");
    render(
      <ChallengeRun
        challenge={challenge}
        mode="hotkey"
        records={records(submit).store}
        onNext={vi.fn()}
      />,
    );

    clickACell();
    solveWithKeys();

    expect(await screen.findByTestId("result-card")).toBeVisible();
    expect(submit).not.toHaveBeenCalled();
  });

  it("forgives that same click at encouraged, which is the default", async () => {
    const submit = vi.fn();

    render(
      <ChallengeRun
        challenge={challenge}
        mode="hotkey"
        records={records(submit).store}
        onNext={vi.fn()}
      />,
    );

    clickACell();
    solveWithKeys();

    await screen.findByTestId("result-card");
    expect(submit).toHaveBeenCalledWith(expect.objectContaining({ mode: "hotkey" }));
  });

  it("refuses the pointer outright at ranked, so the question never arises", async () => {
    const submit = vi.fn();

    withStrictness("ranked");
    render(
      <ChallengeRun
        challenge={challenge}
        mode="hotkey"
        records={records(submit).store}
        onNext={vi.fn()}
      />,
    );

    expect(screen.getByTestId("hotkey-objective")).toHaveTextContent("the pointer is off");

    // The click lands on nothing — the grid never dispatches it — so the run stays pure and rankable.
    clickACell();
    solveWithKeys();

    await screen.findByTestId("result-card");
    expect(submit).toHaveBeenCalledWith(expect.objectContaining({ mode: "hotkey" }));
  });

  it("never touches the Speed book", async () => {
    // Records are keyed by mode: a Hotkey best cannot beat a Speed best, or be beaten by one.
    const submit = vi.fn();

    render(
      <ChallengeRun
        challenge={challenge}
        mode="hotkey"
        records={records(submit).store}
        onNext={vi.fn()}
      />,
    );

    solveWithKeys();

    await screen.findByTestId("result-card");
    expect(submit).not.toHaveBeenCalledWith(expect.objectContaining({ mode: "main-speed" }));
  });
});
