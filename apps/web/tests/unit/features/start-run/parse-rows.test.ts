import { describe, expect, it } from "vitest";
import { parseRows } from "@/features/start-run/parse-rows";

const valid = new Set([8, 9, 25]);

describe("parseRows", () => {
  it("parses 8, 9, 25", () => expect(parseRows("8, 9, 25", valid)).toEqual({ ok: true, rows: [8, 9, 25] }));
  it("dedupes", () => expect(parseRows("8 8,9", valid)).toEqual({ ok: true, rows: [8, 9] }));
  it("rejects words", () =>
    expect(parseRows("8, x", valid)).toEqual({ ok: false, message: "Rows are numbers separated by commas, like 8, 9, 25" }));
  it("rejects empty", () =>
    expect(parseRows("  ,", valid)).toEqual({ ok: false, message: "Enter at least one row, like 8, 9, 25" }));
  it("names one bad row", () =>
    expect(parseRows("8, 52", valid)).toEqual({ ok: false, message: "Row 52 isn't a teaching day in this outline" }));
  it("names several bad rows", () =>
    expect(parseRows("52, 60", valid)).toEqual({ ok: false, message: "Rows 52, 60 aren't teaching days in this outline" }));
  it("skips the membership check when valid is null", () =>
    expect(parseRows("52", null)).toEqual({ ok: true, rows: [52] }));
});
