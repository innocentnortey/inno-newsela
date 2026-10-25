import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, screen, within } from "@testing-library/react";
import { issuedShapeReport } from "../../../../e2e/validation-report/fixtures";
import { ReportView } from "@/features/validation-report/report-view";
import { renderWithSession } from "@/test-utils/render-with-session";
import type { Role } from "@/lib/roles";

afterEach(cleanup);
const actions = { choose: vi.fn(), retry: vi.fn(), undo: vi.fn(), generate: vi.fn() };

function view(role: Role = "author") {
  return renderWithSession(
    <ReportView
      report={issuedShapeReport()}
      unit={{ title: "Grade 6 · Unit 4", unitKey: "g6-u4" }}
      version={{ created_by: "A. Chen", created_at: "2026-10-25T09:30:00Z" }}
      newer={null}
      canEdit={role === "author"}
      roleLabel={role[0]!.toUpperCase() + role.slice(1)}
      status={{}}
      refusal={null}
      forbidden={null}
      generating={false}
      actions={actions}
      dialogOpen={false}
      onCloseDialog={() => {}}
    />,
    role,
  );
}

describe("accessible names", () => {
  it("has one h1, h2 sections and captioned tables", () => {
    view();
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(screen.getByRole("heading", { level: 2, name: "Errors" })).toBeTruthy();
    expect(screen.getByRole("heading", { level: 2, name: "Warnings" })).toBeTruthy();
    expect(screen.getByRole("table", { name: "Errors to confirm" })).toBeTruthy();
    expect(screen.getByRole("table", { name: "Warnings with their defaults" })).toBeTruthy();
    expect(screen.getByRole("table", { name: "ELD labels: 7 of 12 codes flagged" })).toBeTruthy();
  });
  it("names buttons and radio groups per row", () => {
    view();
    expect(screen.getByRole("button", { name: "Confirm fix for row 8" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Confirm U4 for the unit" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Edit fix for row 8" })).toBeTruthy();
    expect(screen.getByRole("group", { name: "Action for row 8, column N" })).toBeTruthy();
    expect(screen.getByRole("group", { name: "ELD label for ELD.PII.6.1" })).toBeTruthy();
  });
  it("Generate is aria-disabled and described by the gate banner", () => {
    view();
    const g = screen.getByRole("button", { name: "Generate 47 lessons" });
    expect(g.getAttribute("aria-disabled")).toBe("true");
    const described = document.getElementById(g.getAttribute("aria-describedby")!);
    expect(described?.textContent).toContain("Generate stays off");
  });
  it.each(["reviewer", "approver"] as const)("%s has no controls", (role) => {
    view(role);
    expect(screen.queryByRole("button", { name: /Confirm|Edit|Undo|Generate/ })).toBeNull();
    expect(screen.queryAllByRole("radio")).toHaveLength(0);
    expect(within(document.body).getByText(new RegExp(`You're viewing as an? ${role}`))).toBeTruthy();
  });
});
