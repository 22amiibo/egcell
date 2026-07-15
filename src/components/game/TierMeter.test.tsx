import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { TierMeter } from "@/components/game/TierMeter";

describe("TierMeter", () => {
  it("fills pips up to the current tier and leaves the rest unfilled", () => {
    render(<TierMeter tier={3} heat={0} heatToPromote={5} overdriveRungs={0} />);

    const status = screen.getByRole("status");
    const pips = [...status.children[0].children];

    expect(pips).toHaveLength(5);
    expect(pips.slice(0, 3).every((pip) => pip.className.includes("bg-accent"))).toBe(true);
    expect(pips.slice(3).every((pip) => pip.className.includes("bg-line"))).toBe(true);
  });

  it("fills heat dots up to the heat count out of heatToPromote", () => {
    render(<TierMeter tier={1} heat={2} heatToPromote={4} overdriveRungs={0} />);

    const status = screen.getByRole("status");
    const dots = [...status.children[1].children];

    expect(dots).toHaveLength(4);
    expect(dots.slice(0, 2).every((dot) => dot.className.includes("bg-warning"))).toBe(true);
    expect(dots.slice(2).every((dot) => dot.className.includes("bg-line"))).toBe(true);
  });

  it("renders the overdrive badge only when overdriveRungs is greater than zero", () => {
    const { rerender } = render(
      <TierMeter tier={5} heat={0} heatToPromote={5} overdriveRungs={0} />,
    );

    expect(screen.queryByText(/OVERDRIVE/)).not.toBeInTheDocument();

    rerender(<TierMeter tier={5} heat={2} heatToPromote={5} overdriveRungs={3} />);

    expect(screen.getByText("OVERDRIVE ×3")).toBeInTheDocument();
  });

  it("builds the aria-label without overdrive when there are no overdrive rungs", () => {
    render(<TierMeter tier={2} heat={1} heatToPromote={5} overdriveRungs={0} />);

    expect(screen.getByRole("status")).toHaveAttribute("aria-label", "Tier 2, heat 1 of 5");
  });

  it("builds the aria-label with overdrive when overdrive rungs are present", () => {
    render(<TierMeter tier={5} heat={3} heatToPromote={5} overdriveRungs={2} />);

    expect(screen.getByRole("status")).toHaveAttribute(
      "aria-label",
      "Tier 5, overdrive 2, heat 3 of 5",
    );
  });
});
