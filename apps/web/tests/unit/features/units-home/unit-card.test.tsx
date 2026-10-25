import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { UnitCard } from "@/features/units-home/unit-card";
import type { components } from "@/lib/api-types";

type Unit = components["schemas"]["Unit"];
const VERSION: Unit["versions"][number] = {
  outline_version_id: "G6.U4.ov2",
  unit_id: "G6.U4",
  unit_key: "g6-u4",
  version_number: 2,
  sha256: "a100000000000000000000000000000000000000000000000000000000000001",
  same_as_version: 1,
  changed_lessons: 0,
  row_counts: { lessons: 41, flex_days: 6, arc_headers: 7, total_rows: 1 },
  created_at: "2026-10-25T15:02:00Z",
  created_by: "Author (demo)",
};
const UNIT: Unit = {
  unit_id: "G6.U4",
  unit_key: "g6-u4",
  title: "Grade 6 · Unit 4",
  versions: [VERSION],
  latest_run: { run_id: "run-0001", state: "running" },
};
const PROGRESS = { counts_by_tile_state: { ready: 12, drafting: 35 } } as unknown as components["schemas"]["RunProgress"];

afterEach(cleanup);

describe("UnitCard", () => {
  it("makes the title the card's single link, to the board", () => {
    render(<UnitCard unit={UNIT} progress={PROGRESS} />);
    const anchors = screen.getAllByRole("link").filter((a) => a.textContent?.includes("Grade 6 · Unit 4"));
    expect(anchors).toHaveLength(1);
    expect(anchors[0]).toHaveAttribute("href", "/units/g6-u4/board");
  });
  it("shows the run pill with glyph and word and the ready count", () => {
    const { container } = render(<UnitCard unit={UNIT} progress={PROGRESS} />);
    expect(screen.getByText("Running")).toBeInTheDocument();
    expect(container.querySelector('[data-status="run.running"] svg')).not.toBeNull();
    expect(screen.getByText("12 of 47 ready")).toBeInTheDocument();
  });
  it("links the no-run sentence to the latest report", () => {
    render(<UnitCard unit={{ ...UNIT, latest_run: null }} progress={undefined} />);
    expect(screen.getByRole("link", { name: "No run yet. Confirm the report, then generate." })).toHaveAttribute(
      "href",
      "/units/g6-u4/outlines/2",
    );
  });
  it("says progress counts couldn't load when progress is unavailable", () => {
    render(<UnitCard unit={UNIT} progress="unavailable" />);
    expect(screen.getByText("Progress counts couldn't load.")).toBeInTheDocument();
    expect(screen.getByText("Running")).toBeInTheDocument();
  });
});
