import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { issuedShapeReport } from "../../../../e2e/validation-report/fixtures";
import { ErrorsSection } from "@/features/validation-report/errors-section";
import { renderWithSession } from "@/test-utils/render-with-session";
import type { ReportActions, TargetStatus } from "@/features/validation-report/report-model";

afterEach(cleanup);

/** Mimics the hook: a rejected edit_fix leaves a failed status with message null (network error and 500 alike). */
function Harness({ fail, actions }: { fail: Error; actions: ReportActions }) {
  const [status, setStatus] = useState<Record<string, TargetStatus>>({});
  const wrapped: ReportActions = {
    ...actions,
    choose: async (req) => {
      actions.choose(req);
      setStatus({ [req.target_id]: { request: req, phase: "failed", message: null } });
      void fail;
      return false;
    },
    retry: async (id) => {
      void actions.retry(id);
      return false;
    },
  };
  return <ErrorsSection report={issuedShapeReport()} canEdit status={status} actions={wrapped} />;
}

describe("edit_fix failure", () => {
  it.each([new Error("network down"), new Error("HTTP 500")])("shows the generic line and Try again, keeps the value (%s)", async (err) => {
    const actions = { choose: vi.fn(), retry: vi.fn(), undo: vi.fn(), generate: vi.fn() };
    renderWithSession(<Harness fail={err} actions={actions} />, "author");
    fireEvent.click(screen.getByRole("button", { name: "Edit fix for row 8" }));
    const input = screen.getByRole("textbox", { name: "Corrected code for row 8" }) as HTMLInputElement;
    fireEvent.change(input, { target: { value: "RL.6.9" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(screen.getByRole("alert").textContent).toContain("Couldn't save this choice. Try again."));
    expect((screen.getByRole("textbox", { name: "Corrected code for row 8" }) as HTMLInputElement).value).toBe("RL.6.9");
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(actions.retry).toHaveBeenCalledTimes(1);
  });
});
