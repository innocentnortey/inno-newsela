import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { issuedShapeReport } from "../../../../e2e/validation-report/fixtures";
import { ReportView } from "@/features/validation-report/report-view";
import { renderWithSession } from "@/test-utils/render-with-session";

afterEach(cleanup);

describe("confirm unit", () => {
  it("confirm unit sends the full unit id", async () => {
    const actions = { choose: vi.fn().mockResolvedValue(true), retry: vi.fn(), undo: vi.fn(), generate: vi.fn() };
    const report = issuedShapeReport();
    expect(report.unit.as_written).toBe("U4");
    renderWithSession(
      <ReportView
        report={report}
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
    await userEvent.click(screen.getByRole("button", { name: "Confirm U4 for the unit" }));
    expect(actions.choose).toHaveBeenCalledTimes(1);
    expect(actions.choose.mock.calls[0]![0]).toMatchObject({ kind: "confirm_unit", value: "G6.U4" });
  });
});
