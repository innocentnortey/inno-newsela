import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
afterEach(cleanup);

import { CapsTag, CodeChip, CountBadge, Marker, VersionChip } from "@/components/ui/badge";

describe("badges", () => {
  it("count badge is tabular", () => {
    render(<CountBadge count={5} />);
    expect(screen.getByText("5")).toHaveClass("tabular-nums");
  });
  it("code chip does not wrap", () => {
    render(<CodeChip>G6.U4.L4.LearningInAction.PartA</CodeChip>);
    expect(screen.getByText("G6.U4.L4.LearningInAction.PartA")).toHaveClass("whitespace-nowrap");
  });
  it("marker, version chip and caps tag render text", () => {
    render(
      <>
        <Marker n={2} />
        <VersionChip version="v3" />
        <CapsTag>Blocking</CapsTag>
      </>,
    );
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getByText("v3")).toBeInTheDocument();
    expect(screen.getByText("Blocking")).toBeInTheDocument();
  });
});
