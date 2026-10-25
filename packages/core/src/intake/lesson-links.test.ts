import { describe, expect, it } from "vitest";
import type { NormalizedRow } from "@ls/schema/outline";
import { load_issued_grid, load_syn3_grid } from "../../tests/fixtures/outline/index.ts";
import { standards_double } from "../../tests/fixtures/outline/standards-double.ts";
import { compute_lesson_links } from "./lesson-links.ts";
import { normalize_outline } from "./normalize.ts";

const rows_of = (g: ReturnType<typeof load_issued_grid>) => normalize_outline(g, standards_double, 200).rows;

describe("compute_lesson_links", () => {
  it("homework_text: Lesson 4 homework links to the Lesson 5 excerpt slot", () => {
    const links = compute_lesson_links(rows_of(load_issued_grid()));
    const l = links.find((x) => x.from_lesson_id === "G6.U4.L4");
    expect(l?.kind).toBe("homework_text");
    expect(l?.to_lesson_id).toBe("G6.U4.L5");
    expect(l?.from_address).toBe("G6.U4.L4.Homework");
    expect(l?.label).toContain("The Hare and the Lion");
    expect(l?.label.startsWith("Lesson 4 Homework → Lesson 5 excerpt slot")).toBe(true);
    expect(compute_lesson_links(rows_of(load_issued_grid()))).toEqual(links);
  });

  it("clean_control: the clean control row has no outgoing links", () => {
    const links = compute_lesson_links(rows_of(load_syn3_grid()));
    expect(links.filter((x) => x.from_lesson_id === "G6.U4.L6")).toEqual([]);
  });

  it("page_continuation: homework ending at page 15 meets a next lesson starting at 16", () => {
    const base = (n: number, over: Partial<NormalizedRow>): NormalizedRow => ({
      row_number: n + 3, kind: "lesson", lesson_id: `G6.U4.L${n}`, number: n, title: "", lesson_type: "Reading",
      arc: "A", segments: [], focus_codes: [], eld_codes: [], msls_codes: [], vocabulary: [],
      homework: null, pages: null, text_set: null, ...over,
    });
    const rows = [base(1, { homework: "Read pp. 9–15" }), base(2, { pages: "16–22" })];
    const links = compute_lesson_links(rows);
    expect(links).toHaveLength(1);
    expect(links[0]?.kind).toBe("page_continuation");
    expect(links[0]?.to_slot_id).toBe("G6.U4.L2.pages");
    expect(compute_lesson_links(rows)).toEqual(links);
  });
});
