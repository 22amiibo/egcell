import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { GameShell } from "@/components/game/GameShell";
import { buildNormalSpeedQueue } from "@/data/challenges/queue";
import { solveChallengeDom } from "@/test/solveVariantDom";

// The flagship default is Ascent (Task 3.5); these specs are about the normal Speed queue
// specifically, so each one switches into Speed first rather than relying on it being the mode a
// fresh shell opens into.
const switchToSpeed = () => fireEvent.click(screen.getByRole("button", { name: "Speed" }));

describe("normal speed session seeds", () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.history.replaceState(null, "", "/");
  });

  it("creates a fresh seed for each unseeded normal start", () => {
    // The shell pins two seeds per mount — one for the normal Speed queue, one for the Ascent
    // climb it opens into by default — so an unseeded mount draws the factory twice.
    const createSessionSeed = vi
      .fn<() => string>()
      .mockReturnValueOnce("normal-one")
      .mockReturnValueOnce("ascent-one")
      .mockReturnValueOnce("normal-two")
      .mockReturnValueOnce("ascent-two");
    const firstQueue = buildNormalSpeedQueue("normal-one");
    const secondQueue = buildNormalSpeedQueue("normal-two");

    const first = render(<GameShell createSessionSeed={createSessionSeed} />);

    switchToSpeed();
    expect(
      screen.getByRole("heading", { name: firstQueue.tasks[0].variant.prompt }),
    ).toBeVisible();

    first.unmount();
    render(<GameShell createSessionSeed={createSessionSeed} />);
    switchToSpeed();

    expect(createSessionSeed).toHaveBeenCalledTimes(4);
    expect(
      screen.getByRole("heading", { name: secondQueue.tasks[0].variant.prompt }),
    ).toBeVisible();
  });

  it("uses an explicit sessionSeed for the exact normal queue without calling the factory", () => {
    // `ascentSeed` is pinned too, so the factory truly never fires for either seed.
    window.history.replaceState(null, "", "/?sessionSeed=abc&ascentSeed=abc-ascent");
    const createSessionSeed = vi.fn<() => string>(() => "must-not-be-used");
    const queue = buildNormalSpeedQueue("abc");

    render(<GameShell createSessionSeed={createSessionSeed} />);
    switchToSpeed();

    expect(createSessionSeed).not.toHaveBeenCalled();
    expect(screen.getByRole("heading", { name: queue.tasks[0].variant.prompt })).toBeVisible();
  });

  it("advances through the generated normal queue", async () => {
    const queue = buildNormalSpeedQueue("normal-sequence");

    render(<GameShell createSessionSeed={() => "normal-sequence"} />);
    await userEvent.click(screen.getByRole("button", { name: "Speed" }));
    solveChallengeDom(queue.tasks[0].variant);
    await userEvent.click(screen.getByRole("button", { name: "Next challenge" }));

    expect(screen.getByRole("heading", { name: queue.tasks[1].variant.prompt })).toBeVisible();
  });

  it("keeps classic challenges available in the picker", async () => {
    render(<GameShell createSessionSeed={() => "normal-picker"} />);

    await userEvent.click(screen.getByRole("button", { name: "Speed" }));
    await userEvent.selectOptions(screen.getByLabelText("Challenge"), "selection.revenue-column");

    expect(screen.getByRole("heading", { name: "Select the Revenue column." })).toBeVisible();
  });
});
