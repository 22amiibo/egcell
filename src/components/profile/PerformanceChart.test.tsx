import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { CategorySelector } from "@/components/profile/CategorySelector";
import { PerformanceChart } from "@/components/profile/PerformanceChart";
import type { PerformanceSeries } from "@/domain/stats/performanceSeries";

function series(overrides: Partial<PerformanceSeries> = {}): PerformanceSeries {
  return {
    categoryId: "speed",
    metricId: "score",
    points: [
      { atMs: 1_760_000_000_000, value: 900, average: 900, isRecord: true, runs: 1 },
      { atMs: 1_760_086_400_000, value: 1200, average: 1050, isRecord: true, runs: 1 },
      { atMs: 1_760_172_800_000, value: 1000, average: 1033, isRecord: false, runs: 1 },
    ],
    bucketed: false,
    runCount: 3,
    hasEnough: true,
    lowerIsBetter: false,
    ...overrides,
  };
}

describe("PerformanceChart", () => {
  it("draws the trend, and says in words what it drew", () => {
    render(<PerformanceChart series={series()} />);

    expect(screen.getByRole("img", { name: "Score over 3 Speed runs." })).toBeInTheDocument();
  });

  it("carries the same numbers as a table, for anyone who cannot see the picture", () => {
    // Not a consolation prize: the same data, in the form that survives being read aloud.
    render(<PerformanceChart series={series()} />);

    const table = screen.getByTestId("performance-table");
    const body = within(table.querySelector("tbody") as HTMLElement);

    expect(within(table).getByText("1,200")).toBeInTheDocument();
    // Two of the three runs were records when they happened; the third was not.
    expect(body.getAllByText("Personal best")).toHaveLength(2);
  });

  it("says there is not enough yet, rather than drawing a line through two dots", () => {
    render(<PerformanceChart series={series({ hasEnough: false, runCount: 2 })} />);

    expect(screen.getByTestId("chart-empty")).toHaveTextContent("Not enough Speed runs yet");
    expect(screen.queryByTestId("performance-chart")).not.toBeInTheDocument();
  });

  it("says a folded chart is folded, so a dot is not mistaken for a run", () => {
    render(<PerformanceChart series={series({ bucketed: true, runCount: 480 })} />);

    expect(screen.getByTestId("performance-chart")).toHaveAttribute(
      "aria-label",
      "Score over 480 Speed runs, averaged by day.",
    );
  });

  it("puts better upward, even for a metric where better means smaller", () => {
    // Pace is elapsed over target, so 0.8 beats 1.2. Without the inversion, improvement would point
    // downward here and upward on every other chart, and the picture would have to be read twice
    // before it could be trusted once.
    const pace = series({
      metricId: "paceIndex",
      lowerIsBetter: true,
      points: [
        { atMs: 1, value: 1.2, average: 1.2, isRecord: true, runs: 1 },
        { atMs: 2, value: 0.8, average: 1.0, isRecord: true, runs: 1 },
      ],
    });

    render(<PerformanceChart series={pace} />);

    const dots = [...screen.getByTestId("performance-chart").querySelectorAll("circle")];
    const [worse, better] = dots.map((dot) => Number(dot.getAttribute("cy")));

    // A smaller `cy` sits higher on the screen.
    expect(better).toBeLessThan(worse);
  });
});

describe("CategorySelector", () => {
  it("offers a category's own metrics, and only those", () => {
    // A sprint has no pace index — no single target to be measured against — so the button is not
    // there to be pressed. The registry decides; the component renders what it is handed.
    render(
      <CategorySelector
        categoryId="sprint-5"
        metricId="score"
        onCategory={vi.fn()}
        onMetric={vi.fn()}
      />,
    );

    const metrics = within(screen.getByRole("group", { name: "Metric" }));

    expect(metrics.getByRole("button", { name: "Tasks" })).toBeInTheDocument();
    expect(metrics.queryByRole("button", { name: "Pace" })).not.toBeInTheDocument();
  });

  it("reports the category the player picked", async () => {
    const user = userEvent.setup();
    const onCategory = vi.fn();

    render(
      <CategorySelector
        categoryId="speed"
        metricId="score"
        onCategory={onCategory}
        onMetric={vi.fn()}
      />,
    );

    await user.click(screen.getByRole("tab", { name: "Hotkey" }));

    expect(onCategory).toHaveBeenCalledWith("hotkey");
  });
});
