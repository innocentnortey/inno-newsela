import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { NorthStarTile } from "@/features/board/north-star-tile";
import type { UnitMetrics } from "@/features/board/data";

const CAPTION = "No baseline yet (AQ-14). Measured with us as reviewers.";
const base = (over: Partial<UnitMetrics["north_star"]>): UnitMetrics => ({
  north_star: {
    median_minutes: 31,
    n: 3,
    fast_approvals: { count: 0, of: 3 },
    approved: { k: 3, total: 47 },
    caption: CAPTION,
    segment_label: null,
    ...over,
  },
  quality: null,
});

afterEach(cleanup);

describe("NorthStarTile", () => {
  it("n 0 shows no number", () => {
    const { container } = render(
      <NorthStarTile
        metrics={base({ median_minutes: null, n: 0, fast_approvals: { count: 0, of: 0 }, approved: { k: 0, total: 47 } })}
        error={false}
        onRetry={() => {}}
      />,
    );
    expect(screen.getByText("No approved lessons yet")).toBeTruthy();
    expect(screen.getByText("approved 0 of 47")).toBeTruthy();
    expect(screen.queryByText(/min$/)).toBeNull();
    expect(container.querySelector(".text-display")).toBeNull();
  });
  it("n 3 shows median, n and caption", () => {
    render(<NorthStarTile metrics={base({})} error={false} onRetry={() => {}} />);
    expect(screen.getByText("31")).toBeTruthy();
    expect(screen.getByText("median · n = 3")).toBeTruthy();
    expect(screen.getByText("fast approvals 0 of 3")).toBeTruthy();
    expect(screen.getByText("approved 3 of 47")).toBeTruthy();
    expect(screen.getByText(CAPTION)).toBeTruthy();
  });
  it("error shows retry sentence and Retry calls onRetry", () => {
    const onRetry = vi.fn();
    render(<NorthStarTile metrics={undefined} error onRetry={onRetry} />);
    expect(screen.getByText("Couldn't load the north-star numbers.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(onRetry).toHaveBeenCalled();
  });
  it("skeleton while loading", () => {
    const { container } = render(<NorthStarTile metrics={undefined} error={false} onRetry={() => {}} />);
    expect(container.querySelector('[data-skeleton="tile"]')).toBeTruthy();
  });
});
