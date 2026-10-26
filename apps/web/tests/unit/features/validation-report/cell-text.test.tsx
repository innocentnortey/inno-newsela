import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, screen } from "@testing-library/react";
import { markupReport } from "../../../../e2e/validation-report/fixtures";
import { ReportView } from "@/features/validation-report/report-view";
import { renderWithSession } from "@/test-utils/render-with-session";

afterEach(cleanup);
const actions = { choose: vi.fn(), retry: vi.fn(), undo: vi.fn(), generate: vi.fn() };

function view() {
  return renderWithSession(
    <ReportView
      report={markupReport()}
      unit={{ title: "Grade 6 · Unit 4", unitKey: "g6-u4" }}
      version={{ created_by: "A. Chen", created_at: "2026-10-25T09:30:00Z" }}
      newer={null}
      canEdit
      roleLabel="Author"
      status={{}}
      refusal={null}
      forbidden={null}
      generating={false}
      actions={actions}
      dialogOpen={false}
      onCloseDialog={() => {}}
    />,
  );
}

describe("cell text is text (R-58)", () => {
  it("shows markup as literal characters and creates no elements", () => {
    const alert = vi.spyOn(window, "alert").mockImplementation(() => {});
    const { container } = view();
    expect(screen.getAllByText("<script>alert(1)</script>").length).toBeGreaterThan(0);
    expect(screen.getAllByText("<b>x</b>").length).toBeGreaterThan(0);
    expect(container.querySelectorAll("script, b").length).toBe(0);
    expect(document.body.querySelectorAll("script, b").length).toBe(0);
    expect(alert).not.toHaveBeenCalled();
    expect(container.innerHTML).not.toContain("<script>alert");
    expect(container.innerHTML).toContain("&lt;script&gt;");
  });
});

describe("nonexistent code proposal", () => {
  it("nonexistent: chips show the corrected list, not one code", () => {
    view();
    for (const code of ["RL.6.1", "RL.6.2", "L.6.4"]) expect(screen.getAllByText(code).length).toBeGreaterThan(0);
  });
});
