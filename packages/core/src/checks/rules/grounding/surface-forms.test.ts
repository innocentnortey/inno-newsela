import { describe, expect, it } from "vitest";
import { build_name_index, scan_names, blank_option_labels } from "./name-scan.ts";
import { rationale_label } from "../../../compile/labels.ts";
import { extract_bare_pages, extract_refs, ref_in_range } from "./page-refs.ts";

const idx = () => build_name_index(["Percy fights."], ["Percy fights."]);

describe("option labels are not part of the sentence (round 3 run: 15 lessons)", () => {
  it.each([
    "B. Incorrect: Switching books every day makes it hard to build knowledge.",
    "C. Incorrect: Nothing in the sentence suggests care or caution.",
    "A. Incorrect: Too short and unclear. It does not say whose idea.",
    "D. Incorrect: Dismissive and informal.",
    "B. Incorrect: Extra pronouns can make references less clear.",
    "D. Incorrect: Strategies should be tried before asking for help.",
  ])("does not flag the first word of: %s", (t) => {
    expect(scan_names(t, idx())).toEqual([]);
  });
  it("still flags an invented name later in the same rationale", () => {
    expect(scan_names("B. Incorrect: Waiting is what Medusa would do.", idx())).toEqual(["Medusa"]);
  });
  it("still flags the same invented name without a label", () => {
    expect(scan_names("Waiting is what Medusa would do.", idx())).toEqual(["Medusa"]);
  });
  it("keeps offsets: blanking replaces the label with spaces of equal length", () => {
    const t = "B. Incorrect: Waiting";
    expect(blank_option_labels(t)).toHaveLength(t.length);
    expect(blank_option_labels(t).trim()).toBe("Waiting");
  });
});

describe("page and chapter reading of real row formatting", () => {
  it("reads a bracketed quoted phrase between page and dash", () => {
    expect(extract_refs('Ch. 15 (pp. 224 ("A few minutes later,…")–233)').filter((r) => r.kind === "page")).toMatchObject([
      { from: 224, to: 233 },
    ]);
  });
  it("reads 'top of' before the second page", () => {
    expect(extract_refs("pp. 219–top of 224")).toMatchObject([{ from: 219, to: 224 }]);
  });
  it("accepts a span that two stated ranges together cover, and nothing beyond", () => {
    const ranges = [{ from: 219, to: 224 }, { from: 224, to: 233 }];
    const [ok] = extract_refs("pp. 219-233");
    const [over] = extract_refs("pp. 219-234");
    expect(ref_in_range(ok!, ranges)).toBe(true);
    expect(ref_in_range(over!, ranges)).toBe(false);
  });
  it("does not turn 'Chapter 15 and one other' into chapters 1 to 15", () => {
    expect(extract_refs("Chapter 15 and one other text")).toMatchObject([{ from: 15, to: 15 }]);
  });
  it("reads 'Chapters 3 and 4' and 'chapters one and two' as separate chapters", () => {
    expect(extract_refs("Chapters 3 and 4")).toMatchObject([{ from: 3, to: 3 }, { from: 4, to: 4 }]);
    expect(extract_refs("chapters one and two")).toMatchObject([{ from: 1, to: 1 }, { from: 2, to: 2 }]);
  });
  it("reads a bare range in a pages cell, and nothing else", () => {
    expect(extract_bare_pages("224–233")).toEqual({ from: 224, to: 233 });
    expect(extract_bare_pages("233")).toEqual({ from: 233, to: 233 });
    expect(extract_bare_pages("pp. 224 and the rest")).toBeNull();
  });
});

describe("names_after_labels", () => {
  it("flags a name the tagger knows when it is first after a label", () => {
    expect(scan_names("B. Incorrect: Grover would wait.", idx())).toEqual(["Grover"]);
    expect(scan_names("B. Incorrect: Athena would wait.", idx())).toEqual(["Athena"]);
  });
  it("flags a later name after a label", () => {
    expect(scan_names("C. Incorrect: Waiting is what Medusa would do.", idx())).toEqual(["Medusa"]);
  });
  it("accepts labels past D", () => {
    expect(scan_names("E. Incorrect: Switching books is hard.", idx())).toEqual([]);
  });
  it("accepts a label on a later line", () => {
    expect(scan_names("A. Correct: Percy fights.\nB. Incorrect: Nothing suggests care.", idx())).toEqual([]);
  });
  it("blanks every label the compiler writes", () => {
    for (let i = 0; i < 6; i += 1) {
      for (const c of [true, false]) {
        expect(blank_option_labels(`${rationale_label(i, c)} Switching`).trim()).toBe("Switching");
      }
    }
  });
});

describe("chapter_lists", () => {
  const sp = (t: string) => extract_refs(t).map((r) => [r.from, r.to]);
  it("reads comma and 'and' lists as separate chapters", () => {
    expect(sp("Chapters 3, 4 and 9")).toEqual([[3, 3], [4, 4], [9, 9]]);
    expect(sp("Chapters 3-5 and 9")).toEqual([[3, 5], [9, 9]]);
  });
  it("reads word ranges", () => {
    expect(sp("chapters one through three")).toEqual([[1, 3]]);
  });
  it("does not read 'and another' items", () => {
    expect(sp("Chapter 15 and 3 other texts")).toEqual([[15, 15]]);
  });
  it("does not claim the chapter between two listed ones", () => {
    const ranges = extract_refs("Chapters 3 and 5").map((r) => ({ from: r.from, to: r.to }));
    expect(ref_in_range(extract_refs("Chapter 4")[0]!, ranges)).toBe(false);
    expect(ref_in_range(extract_refs("Chapter 5")[0]!, ranges)).toBe(true);
  });
  it("bounds a chapter range", () => {
    const ranges = extract_refs("Chapters 3-5").map((r) => ({ from: r.from, to: r.to }));
    for (const [t, ok] of [["Chapter 6", false], ["Chapter 2", false], ["Chapter 5", true]] as const) {
      expect(ref_in_range(extract_refs(t)[0]!, ranges)).toBe(ok);
    }
  });
});

describe("chapter_notation", () => {
  const sp = (t: string) => extract_refs(t).map((r) => [r.from, r.to]);
  it("stops a list at mixed notation", () => {
    expect(sp("Chapters 3 and five")).toEqual([[3, 3]]);
  });
  it("reads the common spellings of one chapter", () => {
    for (const t of ["Ch. 15", "chapter fifteen", "Chapter 15"]) expect(sp(t)).toEqual([[15, 15]]);
    expect(sp("chapter twenty-three")).toEqual([[23, 23]]);
  });
});

describe("page_boundaries", () => {
  const ranges = extract_refs("pp. 224-233").map((r) => ({ from: r.from, to: r.to }));
  const ok = (t: string, rs = ranges) => ref_in_range(extract_refs(t)[0]!, rs);
  it("accepts the edges and rejects the pages just outside", () => {
    expect(ok("p. 223")).toBe(false);
    expect(ok("p. 224")).toBe(true);
    expect(ok("p. 233")).toBe(true);
    expect(ok("p. 234")).toBe(false);
    expect(ok("pp. 224-234")).toBe(false);
  });
  it("checks the WP-1 row range pp. 1-8", () => {
    const rs = extract_refs("pp. 1-8").map((r) => ({ from: r.from, to: r.to }));
    expect(ok("p. 8", rs)).toBe(true);
    expect(ok("p. 9", rs)).toBe(false);
    expect(ok("p. 0", rs)).toBe(false);
  });
});
