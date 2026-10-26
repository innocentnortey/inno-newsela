import { describe, expect, it } from "vitest";
import type { StandardRow } from "@ls/core/ports/standards";
import { build_front_matter_standards } from "./front-matter-standards.ts";
import { load_row, standard_rows } from "./testing/fixtures.ts";

const std = (code: string, text = `text ${code}`): StandardRow => ({ code, set: "CA_CCSS_ELA_6", text, parent_code: null, is_leaf: true, eld_strand: null });

describe("build_front_matter_standards", () => {
  it("orders focus, then supporting (MSLS), then ELD", () => {
    const row = { ...load_row("wp1"), focus_codes: ["A.1"], msls_codes: ["M.1"], eld_codes: ["E.1"] };
    const out = build_front_matter_standards(row, [std("E.1"), std("M.1"), std("A.1")]);
    expect(out.map((s) => [s.code, s.role])).toEqual([["A.1", "focus"], ["M.1", "supporting"], ["E.1", "eld"]]);
    expect(out[0]).toMatchObject({ origin: "outline", asserted_by: "outline", confirmation: null, official_text: "text A.1" });
  });
  it("does not repeat a code seen earlier", () => {
    const row = { ...load_row("wp1"), focus_codes: ["A.1"], msls_codes: [], eld_codes: ["A.1", "E.1"] };
    expect(build_front_matter_standards(row, [std("A.1"), std("E.1")]).map((s) => s.code)).toEqual(["A.1", "E.1"]);
  });
  it("skips a code with no official text", () => {
    const row = { ...load_row("wp1"), focus_codes: ["A.1", "NOPE"], msls_codes: [], eld_codes: [] };
    expect(build_front_matter_standards(row, [std("A.1")]).map((s) => s.code)).toEqual(["A.1"]);
  });
  it("WP-1 row yields its focus codes first", () => {
    const row = load_row("wp1");
    const out = build_front_matter_standards(row, standard_rows(row));
    expect(out.map((s) => s.code)).toEqual(row.focus_codes);
    expect(out.every((s) => s.role === "focus")).toBe(true);
  });

  const leaf = (code: string, parent: string): StandardRow => ({ ...std(code), parent_code: parent });
  const parent = (code: string): StandardRow => ({ ...std(code), is_leaf: false });

  it("narrowed_leaf_replaces_listed_parent", () => {
    const row = { ...load_row("wp1"), focus_codes: ["L.6.4"], msls_codes: [], eld_codes: [] };
    const out = build_front_matter_standards(row, [parent("L.6.4"), leaf("L.6.4.b", "L.6.4")], ["L.6.4.b"]);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ code: "L.6.4.b", role: "focus", origin: "narrowed", asserted_by: "generator", confirmation: "open" });
  });
  it("added_code_when_row_lists_none", () => {
    const row = { ...load_row("wp1"), focus_codes: [], msls_codes: [], eld_codes: [] };
    const out = build_front_matter_standards(row, [std("RL.6.7")], ["RL.6.7"]);
    expect(out[0]).toMatchObject({ code: "RL.6.7", role: "focus", origin: "added", asserted_by: "generator", confirmation: "open" });
  });
  it("added_code_when_row_lists_some", () => {
    const row = { ...load_row("wp1"), focus_codes: ["A.1"], msls_codes: [], eld_codes: [] };
    const out = build_front_matter_standards(row, [std("A.1"), std("RL.6.7")], ["RL.6.7"]);
    expect(out.map((s) => [s.code, s.role, s.origin])).toEqual([["A.1", "focus", "outline"], ["RL.6.7", "supporting", "added"]]);
  });
  it("unknown_tagged_code_is_recorded_with_empty_text", () => {
    const row = { ...load_row("wp1"), focus_codes: ["A.1"], msls_codes: [], eld_codes: [] };
    const out = build_front_matter_standards(row, [std("A.1")], ["L.6.3a"]);
    expect(out[1]).toMatchObject({ code: "L.6.3a", official_text: "", origin: "added", confirmation: "open" });
  });
  it("tagged_listed_code_is_not_added_again", () => {
    const row = { ...load_row("wp1"), focus_codes: ["A.1"], msls_codes: [], eld_codes: [] };
    expect(build_front_matter_standards(row, [std("A.1")], ["A.1", "A.1"]).map((s) => s.code)).toEqual(["A.1"]);
  });
  it("origin_comes_from_the_row_not_the_model", () => {
    const row = { ...load_row("wp1"), focus_codes: ["L.6.4.b"], msls_codes: [], eld_codes: [] };
    const out = build_front_matter_standards(row, [leaf("L.6.4.b", "L.6.4")], ["L.6.4.b"]);
    expect(out[0]).toMatchObject({ origin: "outline", asserted_by: "outline", confirmation: null });
  });
});
