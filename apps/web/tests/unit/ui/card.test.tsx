import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
afterEach(cleanup);

import { Card, MetricTile } from "@/components/ui/card";

describe("Card and MetricTile", () => {
  it("card is a labelled region", () => {
    render(<Card title="Summary">x</Card>);
    expect(screen.getByRole("region", { name: "Summary" })).toBeInTheDocument();
  });
  it("metric tile shows its number", () => {
    render(<MetricTile title="Time to approve" value="42" unit="min" />);
    expect(screen.getByText("42")).toBeInTheDocument();
  });
  it("null value shows the empty text and no number", () => {
    const { container } = render(<MetricTile title="Time to approve" value={null} unit="min" caption="median" />);
    expect(screen.getByText("No approved lessons yet")).toBeInTheDocument();
    expect(container.textContent).not.toMatch(/\d/);
  });
});
