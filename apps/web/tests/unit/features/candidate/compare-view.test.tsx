import { cleanup, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { CompareView } from "@/features/candidate/compare-view";
import { alignRows, type Section } from "@/features/candidate/derive";
import { renderWithSession } from "@/test-utils/render-with-session";

const sec = (address: string, name: string, text: string): Section =>
  ({ address, name, minutes: 5, content: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text }] }] } }) as unknown as Section;
const current = [sec("L.A", "Launch", "old A"), sec("L.B", "Look Back", "old B"), sec("L.C", "Homework", "old C")];
const candidate = [sec("L.A", "Launch", "new A"), sec("L.B", "Look Back", "new B"), sec("L.C", "Homework", "new C")];
const rows = alignRows(current, candidate);

const props = { rows, versionLabel: "Candidate v4", canAdopt: true, adoptedBy: {}, busy: null, onAdopt: () => {} };
afterEach(cleanup);

describe("compare view", () => {
  it("rows: one Adopt this section button per row on the candidate side", () => {
    renderWithSession(<CompareView {...props} wide />, "reviewer");
    expect(screen.getAllByRole("button", { name: /^Adopt this section/ })).toHaveLength(3);
    expect(screen.getByText("old A")).toBeTruthy();
    expect(screen.getByText("new A")).toBeTruthy();
  });
  it("rows: adopt buttons name their section", () => {
    renderWithSession(<CompareView {...props} wide />, "reviewer");
    expect(screen.getByRole("button", { name: "Adopt this section: Look Back" })).toBeTruthy();
  });
  it("rows: adoptedBy replaces the button with Adopted by J. Rivera", () => {
    renderWithSession(<CompareView {...props} wide adoptedBy={{ "L.B": "J. Rivera" }} />, "reviewer");
    expect(screen.getByText("Adopted by J. Rivera")).toBeTruthy();
    expect(screen.getAllByRole("button", { name: /^Adopt this section/ })).toHaveLength(2);
    expect(screen.queryByRole("button", { name: "Adopt this section: Look Back" })).toBeNull();
  });
  it("tabs: narrow renders Current and Candidate triggers", () => {
    renderWithSession(<CompareView {...props} wide={false} />, "reviewer");
    const tabs = screen.getAllByRole("tab").map((t) => t.textContent);
    expect(tabs).toEqual(["Current", "Candidate"]);
    expect(screen.getByText("new A")).toBeTruthy();
    expect(screen.queryByText("old A")).toBeNull();
  });
  it("text only: a script tag in content is drawn as text", () => {
    const evil = [sec("L.A", "Launch", "<script>alert(1)</script>")];
    const { container } = renderWithSession(<CompareView {...props} wide rows={alignRows(evil, evil)} />, "reviewer");
    expect(container.querySelector("script")).toBeNull();
    expect(screen.getAllByText("<script>alert(1)</script>").length).toBeGreaterThan(0);
  });
});
