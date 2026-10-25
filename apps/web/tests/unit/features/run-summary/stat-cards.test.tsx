import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { StatCards } from "@/features/run-summary/stat-cards";
import type { components } from "@/lib/api-types";

type RunSummary = components["schemas"]["RunSummary"];

const summary = (over: Partial<RunSummary> = {}): RunSummary => ({
  run_id: "run-0001",
  state: "complete",
  n: 3,
  wall_time_seconds: 61,
  cost_usd: 1.2,
  cost_per_ready_lesson_usd: 0.4999,
  lessons: { ready: 3, failed: 0 },
  retries: 1,
  failures_by_reason: [],
  placeholders_left: 0,
  calls_lost_in_flight: 0,
  brakes_fired: [],
  truncation_retries: 0,
  p95_minutes_per_lesson: 4.9999,
  target_minutes_per_lesson: 5,
  report_path: null,
  ...over,
});

afterEach(cleanup);

describe("StatCards", () => {
  it("shows stored values verbatim in a dl with tabular figures", () => {
    const { container } = render(<StatCards summary={summary()} />);
    expect(container.querySelector("dl")).not.toBeNull();
    const terms = Array.from(container.querySelectorAll("dt")).map(
      (e) => e.textContent,
    );
    expect(terms).toEqual([
      "Wall time",
      "Cost per lesson",
      "p95 minutes per lesson",
      "Retries",
    ]);
    expect(screen.getByText("$0.4999")).toBeInTheDocument();
    expect(screen.getByText(/4\.9999/)).toBeInTheDocument();
    expect(screen.getByText(/^61/)).toBeInTheDocument();
    expect(container.textContent).toContain("$1.20");
    expect(screen.getByText("against the 5-minute target")).toBeInTheDocument();
    expect(
      container.textContent!.split("n = 3 lessons").length - 1,
    ).toBeGreaterThanOrEqual(3);
    for (const dd of container.querySelectorAll("dd.text-display"))
      expect(dd.className).toContain("tabular-nums");
    expect(container.querySelectorAll("dd.text-display").length).toBe(4);
  });
  it("shows words, not numbers, for missing figures", () => {
    const { container } = render(
      <StatCards
        summary={summary({
          cost_per_ready_lesson_usd: null,
          p95_minutes_per_lesson: null,
          lessons: { ready: 0, failed: 3 },
          cost_usd: 0,
        })}
      />,
    );
    expect(screen.getByText("No ready lessons yet")).toBeInTheDocument();
    expect(screen.getByText("No figure yet")).toBeInTheDocument();
    expect(screen.getByText("against the 5-minute target")).toBeInTheDocument();
    expect(container.querySelectorAll("dd.text-display").length).toBe(2);
  });
});
