import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CoverageGate } from "@/features/coverage/coverage-gate";

vi.mock("@/features/frame/nav", () => ({ FIRED_CUTS: [4] }));

afterEach(cleanup);

describe("cut-flag", () => {
  it("shows not-found instead of the page when cut 4 has fired", () => {
    render(
      <CoverageGate fired={[4]}>
        <p>inside</p>
      </CoverageGate>,
    );
    expect(screen.getByText(/There is no page in/)).toBeTruthy();
    expect(screen.queryByText("inside")).toBeNull();
  });
  it("shows the page when cut 4 has not fired", () => {
    render(
      <CoverageGate fired={[]}>
        <p>inside</p>
      </CoverageGate>,
    );
    expect(screen.getByText("inside")).toBeTruthy();
  });
  it("the board hides Coverage (and only the cut-4 link) when FIRED_CUTS has 4", async () => {
    const { LinksRow } = await import("@/features/board/links-row");
    render(<LinksRow unitKey="g6-u4" runId="run-1" />);
    expect(screen.queryByRole("link", { name: "Coverage" })).toBeNull();
    expect(screen.getByRole("link", { name: "Export" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Unit quality" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Run summary" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Unit quality" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Run summary" })).toBeTruthy();
  });
  it("the default gate follows the mocked FIRED_CUTS", () => {
    render(
      <CoverageGate>
        <p>inside</p>
      </CoverageGate>,
    );
    expect(screen.queryByText("inside")).toBeNull();
  });
});
