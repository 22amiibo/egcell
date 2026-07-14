import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ChallengeRun } from "@/components/game/ChallengeRun";
import { challenges } from "@/data/challenges";
import type { Challenge } from "@/domain/challenges/challengeTypes";
import type { GridCommandId } from "@/domain/commands/commandTypes";
import { getRoutes } from "@/domain/routes/routeCache";
import type { Route } from "@/domain/routes/routeTypes";
import { DEFAULT_SETTINGS, type Settings } from "@/domain/settings/themes";
import type { LocalPersonalRecords } from "@/hooks/useLocalPersonalRecords";

// `vi.hoisted` runs before the imports it would otherwise close over, so the real defaults are
// installed in `beforeEach` — which runs after them.
const settings = vi.hoisted(() => ({ current: null as unknown as Settings }));

vi.mock("@/hooks/useSettings", () => ({
  useSettings: () => ({ settings: settings.current, updateSection: vi.fn(), reset: vi.fn() }),
}));

/** The chords for the arrow commands, which is all a navigation route ever needs. */
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

/** A navigation drill whose whole route is arrows, so a complete run fits inside a test. */
const challenge: Challenge = challenges.find(
  (candidate) =>
    candidate.validation.kind === "navigation" &&
    (getRoutes(candidate) ?? []).length > 0 &&
    (getRoutes(candidate) as Route[])[0].steps.every((step) => KEYS[step.command] !== undefined),
)!;

function records(submit = vi.fn()): LocalPersonalRecords {
  return { records: {}, getBest: () => undefined, submit } as unknown as LocalPersonalRecords;
}

beforeEach(() => {
  settings.current = DEFAULT_SETTINGS;
});

async function reveal(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByTestId("help-control"));
  await user.click(screen.getByRole("button", { name: "Reveal" }));
}

describe("revealing the fastest path", () => {
  it("asks first, because the trade cannot be taken back", async () => {
    const user = userEvent.setup();

    render(
      <ChallengeRun challenge={challenge} mode="main-speed" records={records()} onNext={vi.fn()} />,
    );

    await user.click(screen.getByTestId("help-control"));

    // Nothing revealed, nothing unranked: so far this is only a question.
    expect(screen.getByTestId("help-confirm")).toHaveTextContent("Unranks this run.");
    expect(screen.queryByTestId("help-panel")).not.toBeInTheDocument();
    expect(screen.queryByTestId("unranked-badge")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(screen.queryByTestId("help-confirm")).not.toBeInTheDocument();
    expect(screen.queryByTestId("unranked-badge")).not.toBeInTheDocument();
  });

  it("shows the path, and says once that the run is now unranked", async () => {
    const user = userEvent.setup();

    render(
      <ChallengeRun challenge={challenge} mode="main-speed" records={records()} onNext={vi.fn()} />,
    );
    await reveal(user);

    expect(screen.getAllByTestId("help-panel")[0]).toBeInTheDocument();
    expect(screen.getByTestId("unranked-badge")).toBeVisible();
    expect(screen.getByRole("status")).toHaveTextContent(
      "Fastest path revealed. This run is now unranked.",
    );
  });

  it("stays unranked after the panel is hidden again", async () => {
    // The central contract. Hiding is a display toggle, not an undo: a run that could be un-assisted
    // by pressing the same button twice would rank a player for work they did not do.
    const user = userEvent.setup();

    render(
      <ChallengeRun challenge={challenge} mode="main-speed" records={records()} onNext={vi.fn()} />,
    );
    await reveal(user);
    await user.click(screen.getByRole("button", { name: "Hide fastest path" }));

    expect(screen.queryByTestId("help-panel")).not.toBeInTheDocument();
    expect(screen.getByTestId("unranked-badge")).toBeVisible();
  });

  it("banks no personal record for the assisted attempt — and the policy is what stops it", async () => {
    const user = userEvent.setup();
    const submit = vi.fn();

    render(
      <ChallengeRun
        challenge={challenge}
        mode="main-speed"
        records={records(submit)}
        onNext={vi.fn()}
      />,
    );
    await reveal(user);

    // Solve it by walking the solver's own route — the same steps the panel is showing the player.
    // The run still plays, still grades, still scores. It simply never reaches the record book,
    // because `getRunEligibility` says an assisted run counts for nothing (§6.2). There is no second
    // `if (assisted)` anywhere on the run surface, and there must never be one.
    const grid = screen.getByRole("grid");

    for (const step of (getRoutes(challenge) as Route[])[0].steps) {
      fireEvent.keyDown(grid, KEYS[step.command]);
    }

    expect(await screen.findByTestId("result-card")).toBeVisible();
    expect(submit).not.toHaveBeenCalled();
  });

  it("opens Practice already revealed when the player asked for that", () => {
    settings.current = {
      ...DEFAULT_SETTINGS,
      help: { ...DEFAULT_SETTINGS.help, autoRevealInPractice: true },
    };

    render(
      <ChallengeRun challenge={challenge} mode="practice" records={records()} onNext={vi.fn()} />,
    );

    // No confirmation, because there is nothing left to confirm: the path was showing before the
    // player touched a key. The run is assisted, and says so from the first render.
    expect(screen.getAllByTestId("help-panel")[0]).toBeInTheDocument();
    expect(screen.getByTestId("unranked-badge")).toBeVisible();
  });

  it("skips the confirmation for a player who turned it off", async () => {
    const user = userEvent.setup();

    settings.current = {
      ...DEFAULT_SETTINGS,
      help: { ...DEFAULT_SETTINGS.help, confirmBeforeReveal: false },
    };

    render(
      <ChallengeRun challenge={challenge} mode="main-speed" records={records()} onNext={vi.fn()} />,
    );
    await user.click(screen.getByTestId("help-control"));

    expect(screen.queryByTestId("help-confirm")).not.toBeInTheDocument();
    expect(screen.getByTestId("unranked-badge")).toBeVisible();
  });
});
