import { describe, expect, it } from "vitest";
import { load_issued_grid, load_issued_xlsx_bytes } from "../../tests/fixtures/outline/index.ts";
import { parse_workbook } from "./parse-grid.ts";

const enc = (s: string): Uint8Array => new TextEncoder().encode(s);

describe("parse_workbook", () => {
  it("csv_xlsx_equal: the same sheet as CSV and XLSX gives the same grid", () => {
    const csv = load_issued_grid();
    const xlsx = parse_workbook(load_issued_xlsx_bytes(), "xlsx");
    expect(xlsx.rows).toEqual(csv.rows);
    expect(csv.sheet_name).toBe("");
    expect(xlsx.sheet_name).toBe("Lesson Outline");
    const cells = csv.rows.flat();
    expect(cells.some((c) => c.includes("\n"))).toBe(true);
    expect(cells.some((c) => c.includes("\u00a0")) || cells.some((c) => c.includes("\t"))).toBe(true);
    expect(new Set(csv.rows.map((r) => r.length)).size).toBe(1);
  });

  it("csv_rfc4180: quotes, embedded newlines, CRLF, lone CR, BOM and untouched whitespace", () => {
    const g = parse_workbook(enc('﻿a,"b ""q"" \n x",c\r\n\u00a0 d ,\te,\r"f"\r\n\r\n'), "csv");
    expect(g.rows).toEqual([
      ["a", 'b "q" \n x', "c"],
      ["\u00a0 d ", "\te", ""],
      ["f", "", ""],
    ]);
  });

  it("csv_literal_quote: a quote inside an unquoted field is kept as is", () => {
    expect(parse_workbook(enc('ab"c,d\n'), "csv").rows).toEqual([['ab"c', "d"]]);
  });

  it("csv_pads_ragged_rows_and_rejects_invalid_utf8", () => {
    expect(parse_workbook(enc("a,b,c\nd\n"), "csv").rows).toEqual([["a", "b", "c"], ["d", "", ""]]);
    try {
      parse_workbook(new Uint8Array([0x61, 0x2c, 0xff, 0xfe]), "csv");
      throw new Error("expected refusal");
    } catch (e) {
      expect((e as { details?: { reason?: string } }).details?.reason).toBe("not_csv_or_xlsx");
    }
  });
});
