import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
afterEach(cleanup);

import { readFileSync } from "node:fs";
import path from "node:path";
import { StatusPill } from "@/components/ui/status-pill";
import { STATUS_SPECS, type StatusKey } from "@/components/ui/status";

/** A pill is not colour-only when it has a glyph (if its spec has one) and a non-empty text label. */
export function isNotColourOnly(container: HTMLElement, key: StatusKey): boolean {
  const spec = STATUS_SPECS[key];
  const hasGlyph = spec.glyph === "none" || container.querySelector("svg[aria-hidden='true'][data-glyph]") !== null;
  const hasLabel = (container.textContent ?? "").trim().length > 0;
  return hasGlyph && hasLabel;
}

const keys = Object.keys(STATUS_SPECS) as StatusKey[];

describe("design.md section 2 coverage", () => {
  it("every state named in the section 2 table exists in STATUS_SPECS", () => {
    const md = readFileSync(path.resolve(__dirname, "../../../../../docs/design/design.md"), "utf8");
    const section = md.split("## 2. Status vocabulary")[1].split("\n## 3.")[0];
    const names = new Set<string>();
    for (const row of section.split("\n").filter((l) => /^\| (Lesson|Tile|Run|Issue|Standard origin|Validation row) \|/.test(l))) {
      const cells = row.split("|").map((c) => c.trim());
      const thing = { Lesson: "lesson", Tile: "tile", Run: "run", Issue: "issue", "Standard origin": "origin", "Validation row": "validation" }[cells[1]]!;
      const states = cells[2].replace(/`/g, "").split(/\s*·\s*|\s+or\s+/).map((x) => x.trim().toLowerCase());
      for (const st of states) names.add(`${thing}.${st}`);
    }
    for (const n of names) expect(Object.keys(STATUS_SPECS), n).toContain(n);
    expect(keys).toHaveLength(33);
    expect(names.size).toBe(keys.length);
  });
});

describe("StatusPill", () => {
  it.each(keys)("%s renders its glyph and label", (key) => {
    const spec = STATUS_SPECS[key];
    const { container } = render(<StatusPill status={key} />);
    expect(screen.getByText(spec.label)).toBeInTheDocument();
    const svg = container.querySelector(`svg[aria-hidden='true'][data-glyph='${spec.glyph}']`);
    if (spec.glyph === "none") expect(container.querySelector("svg")).toBeNull();
    else expect(svg).not.toBeNull();
    expect(isNotColourOnly(container, key)).toBe(true);
  });

  const withGlyph = keys.filter((k) => STATUS_SPECS[k].glyph !== "none");
  it.each(withGlyph)("%s without its glyph is flagged as colour-only", (key) => {
    const { container } = render(<StatusPill status={key} />);
    container.querySelector("svg")!.remove();
    expect(isNotColourOnly(container, key)).toBe(false);
  });
  it.each(keys)("%s without its label is flagged as colour-only", (key) => {
    const { container } = render(<StatusPill status={key} />);
    container.querySelectorAll("span span").forEach((s) => (s.textContent = ""));
    expect(isNotColourOnly(container, key)).toBe(false);
  });

  it("shows by and detail", () => {
    render(
      <>
        <StatusPill status="issue.resolved" by="Sam" />
        <StatusPill status="tile.repairing" detail="1 repair" />
      </>,
    );
    expect(screen.getByText("Resolved by Sam")).toBeInTheDocument();
    expect(screen.getByText("Repairing (1 repair)")).toBeInTheDocument();
  });
});
