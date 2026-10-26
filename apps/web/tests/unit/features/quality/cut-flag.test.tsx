import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { QualityGate } from "@/features/quality/quality-gate";

vi.mock("@/features/frame/nav", () => ({ FIRED_CUTS: [6] }));
afterEach(cleanup);

describe("cut-flag", () => {
  it("shows not-found instead of the page when cut 6 has fired", () => {
    render(
      <QualityGate fired={[6]}>
        <p>inside</p>
      </QualityGate>,
    );
    expect(screen.getByText(/There is no page in/)).toBeTruthy();
    expect(screen.queryByText("inside")).toBeNull();
  });
  it("shows the page when no cut has fired, or only another cut", () => {
    render(
      <QualityGate fired={[]}>
        <p>inside</p>
      </QualityGate>,
    );
    expect(screen.getByText("inside")).toBeTruthy();
    cleanup();
    render(
      <QualityGate fired={[5]}>
        <p>inside</p>
      </QualityGate>,
    );
    expect(screen.getByText("inside")).toBeTruthy();
  });
  it("the board hides Unit quality (and keeps Export) when FIRED_CUTS has 6", async () => {
    const { LinksRow } = await import("@/features/board/links-row");
    render(<LinksRow unitKey="g6-u4" runId={null} />);
    expect(screen.queryByRole("link", { name: "Unit quality" })).toBeNull();
    expect(screen.getByRole("link", { name: "Export" })).toBeTruthy();
  });
});
