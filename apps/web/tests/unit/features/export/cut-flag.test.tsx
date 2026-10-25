import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ExportGate } from "@/features/export/export-gate";

vi.mock("@/features/frame/nav", () => ({ FIRED_CUTS: [5] }));

afterEach(cleanup);

describe("cut-flag", () => {
  it("shows not-found instead of the page when cut 5 has fired", () => {
    render(
      <ExportGate fired={[5]}>
        <p>inside</p>
      </ExportGate>,
    );
    expect(screen.getByText(/There is no page in/)).toBeTruthy();
    expect(screen.queryByText("inside")).toBeNull();
  });
  it("shows the page when cut 5 has not fired", () => {
    render(
      <ExportGate fired={[]}>
        <p>inside</p>
      </ExportGate>,
    );
    expect(screen.getByText("inside")).toBeTruthy();
  });
  it("the board hides Export (and only the cut-5 link) when FIRED_CUTS has 5", async () => {
    const { LinksRow } = await import("@/features/board/links-row");
    render(<LinksRow unitKey="g6-u4" runId="run-1" />);
    expect(screen.queryByRole("link", { name: "Export" })).toBeNull();
    expect(screen.getByRole("link", { name: "Coverage" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Unit quality" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Run summary" })).toBeTruthy();
  });
  it("the default gate follows the mocked FIRED_CUTS", () => {
    render(
      <ExportGate>
        <p>inside</p>
      </ExportGate>,
    );
    expect(screen.queryByText("inside")).toBeNull();
  });
});
