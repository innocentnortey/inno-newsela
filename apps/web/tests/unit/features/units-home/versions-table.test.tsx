import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { VersionsTable } from "@/features/units-home/versions-table";
import type { components } from "@/lib/api-types";

type V = components["schemas"]["OutlineVersion"];
const mk = (n: number, sha: string, same: number | null, changed = 0): V => ({
  outline_version_id: `G6.U4.ov${n}`,
  unit_id: "G6.U4",
  unit_key: "g6-u4",
  version_number: n,
  sha256: sha,
  same_as_version: same,
  changed_lessons: changed,
  row_counts: { lessons: 41, flex_days: 6, arc_headers: 7, total_rows: 1 },
  created_at: "2026-10-25T15:02:00Z",
  created_by: "Author (demo)",
});
const VERSIONS = [mk(2, "a1" + "0".repeat(62), 1), mk(1, "c3" + "0".repeat(62), null)];

afterEach(cleanup);

describe("VersionsTable", () => {
  it("has the caption Outline versions", () => {
    render(<VersionsTable unitKey="g6-u4" versions={VERSIONS} />);
    expect(screen.getByRole("table", { name: "Outline versions" })).toBeInTheDocument();
  });
  it("shows an 8-character hash and 'same as v1' only on a repeated hash", () => {
    render(<VersionsTable unitKey="g6-u4" versions={VERSIONS} />);
    expect(screen.getByText("a1000000")).toBeInTheDocument();
    expect(screen.getByText("c3000000")).toBeInTheDocument();
    expect(screen.getAllByText("same as v1")).toHaveLength(1);
    const rows = screen.getAllByRole("row");
    expect(within(rows[2]!).queryByText(/same as/)).toBeNull();
  });
  it("links each row to its report", () => {
    render(<VersionsTable unitKey="g6-u4" versions={VERSIONS} />);
    expect(screen.getByRole("link", { name: "Validation report, version 2" })).toHaveAttribute("href", "/units/g6-u4/outlines/2");
    expect(screen.getByRole("link", { name: "Validation report, version 1" })).toHaveAttribute("href", "/units/g6-u4/outlines/1");
  });
  it("writes the changed-lessons sentence", () => {
    render(<VersionsTable unitKey="g6-u4" versions={[mk(2, "a1" + "0".repeat(62), 1, 1), VERSIONS[1]!]} />);
    expect(screen.getByText("Version 2 is the same as version 1; 1 lesson changed.")).toBeInTheDocument();
  });
});
