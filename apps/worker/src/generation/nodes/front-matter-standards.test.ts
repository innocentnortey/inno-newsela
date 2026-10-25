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
});
