import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { GameShell } from "@/components/game/GameShell";
import { buildNormalSpeedQueue } from "@/data/challenges/queue";
import { solveChallengeDom } from "@/test/solveVariantDom";

describe("normal speed session seeds", () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.history.replaceState(null, "", "/");
  });

  it("creates a fresh seed for each unseeded normal start", () => {
    const createSessionSeed = vi
      .fn<() => string>()
      .mockReturnValueOnce("normal-one")
      .mockReturnValueOnce("normal-two");
    const firstQueue = buildNormalSpeedQueue("normal-one");
    const secondQueue = buildNormalSpeedQueue("normal-two");

    const first = render(<GameShell createSessionSeed={createSessionSeed} />);

    expect(
      screen.getByRole("heading", { name: firstQueue.tasks[0].variant.prompt }),
    ).toBeVisible();

    first.unmount();
    render(<GameShell createSessionSeed={createSessionSeed} />);

    expect(createSessionSeed).toHaveBeenCalledTimes(2);
    expect(
      screen.getByRole("heading", { name: secondQueue.tasks[0].variant.prompt }),
    ).toBeVisible();
  });

  it("uses an explicit sessionSeed for the exact normal queue without calling the factory", () => {
    window.history.replaceState(null, "", "/?sessionSeed=abc");
    const createSessionSeed = vi.fn<() => string>(() => "must-not-be-used");
    const queue = buildNormalSpeedQueue("abc");

    render(<GameShell createSessionSeed={createSessionSeed} />);

    expect(createSessionSeed).not.toHaveBeenCalled();
    expect(screen.getByRole("heading", { name: queue.tasks[0].variant.prompt })).toBeVisible();
  });

  it("advances through the generated normal queue", async () => {
    const queue = buildNormalSpeedQueue("normal-sequence");

    render(<GameShell createSessionSeed={() => "normal-sequence"} />);
    solveChallengeDom(queue.tasks[0].variant);
    await userEvent.click(screen.getByRole("button", { name: "Next challenge" }));

    expect(screen.getByRole("heading", { name: queue.tasks[1].variant.prompt })).toBeVisible();
  });

  it("keeps classic challenges available in the picker", async () => {
    render(<GameShell createSessionSeed={() => "normal-picker"} />);

    await userEvent.selectOptions(screen.getByLabelText("Challenge"), "selection.revenue-column");

    expect(screen.getByRole("heading", { name: "Select the Revenue column." })).toBeVisible();
  });
});
