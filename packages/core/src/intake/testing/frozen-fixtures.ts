// FROZEN with NL-16 (risk::security). Test-only helpers for the AC-2 and AC-7 frozen tests.
// Builds grids from the synthetic/issued sample JSON under docs/data/samples (no restricted data).
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { utils, write } from "xlsx";

const SAMPLES = resolve(import.meta.dirname, "../../../../../docs/data/samples");

interface SampleRow { sheet_row: number; [k: string]: unknown }
interface Sample { title_cell_A1: string; column_headers_row2: Record<string, string>; rows: SampleRow[] }

function load(name: string): Sample {
  return JSON.parse(readFileSync(resolve(SAMPLES, name), "utf8")) as Sample;
}

function cell(v: unknown): string {
  if (v === undefined || v === null) return "";
  if (typeof v === "number") return Number.isInteger(v) ? v.toFixed(1) : String(v);
  return String(v);
}

/** The issued sheet as raw string rows (16 columns), optionally replacing one sheet row. */
export function issued_rows(replace?: { sheet_file: string }): string[][] {
  const base = load("g6-u4-lesson-outline.json");
  const keys = Object.keys(base.column_headers_row2);
  const width = keys.length;
  const grid: string[][] = [];
  const title = new Array<string>(width).fill("");
  title[0] = base.title_cell_A1;
  grid[0] = title;
  grid[1] = keys.map((k) => base.column_headers_row2[k] ?? "");
  const put = (r: SampleRow): void => {
    grid[r.sheet_row - 1] = keys.map((k) => cell(r[k]));
  };
  for (const r of base.rows) put(r);
  if (replace) for (const r of load(replace.sheet_file).rows) put(r);
  for (let i = 0; i < grid.length; i++) grid[i] ??= new Array<string>(width).fill("");
  return grid;
}

export const issued_grid = () => ({ rows: issued_rows(), sheet_name: "Lesson Outline" });
export const syn1_grid = () => ({
  rows: issued_rows({ sheet_file: "synthetic-2026-10-24-syn1-injection-row09.json" }),
  sheet_name: "Lesson Outline",
});
export const syn3_grid = () => ({
  rows: issued_rows({ sheet_file: "synthetic-2026-10-24-syn3-clean-control-row10.json" }),
  sheet_name: "Lesson Outline",
});

/** Build XLSX bytes from a string matrix (every cell a string). */
export function xlsx_bytes(rows: string[][], sheet_name = "S"): Uint8Array {
  const wb = utils.book_new();
  utils.book_append_sheet(wb, utils.aoa_to_sheet(rows), sheet_name);
  return new Uint8Array(write(wb, { type: "array", bookType: "xlsx" }) as ArrayBuffer);
}

/** Build XLSX bytes from a raw worksheet object (for declared ranges and formula cells). */
export function xlsx_bytes_from_sheet(ws: Record<string, unknown>, sheet_name = "S"): Uint8Array {
  const wb = utils.book_new();
  utils.book_append_sheet(wb, ws as never, sheet_name);
  return new Uint8Array(write(wb, { type: "array", bookType: "xlsx" }) as ArrayBuffer);
}

/** Minimal stored zip whose central directory declares `declared_uncompressed` bytes for one entry. No inflate possible. */
export function zip_declaring(declared_uncompressed: number, name = "xl/worksheets/sheet1.xml"): Uint8Array {
  const nm = new TextEncoder().encode(name);
  const local = new Uint8Array(30 + nm.length);
  const lv = new DataView(local.buffer);
  lv.setUint32(0, 0x04034b50, true);
  lv.setUint16(4, 20, true);
  lv.setUint16(26, nm.length, true);
  local.set(nm, 30);
  const cd = new Uint8Array(46 + nm.length);
  const cv = new DataView(cd.buffer);
  cv.setUint32(0, 0x02014b50, true);
  cv.setUint16(4, 20, true);
  cv.setUint16(6, 20, true);
  cv.setUint32(24, declared_uncompressed, true);
  cv.setUint16(28, nm.length, true);
  cv.setUint32(42, 0, true);
  cd.set(nm, 46);
  const eocd = new Uint8Array(22);
  const ev = new DataView(eocd.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(8, 1, true);
  ev.setUint16(10, 1, true);
  ev.setUint32(12, cd.length, true);
  ev.setUint32(16, local.length, true);
  const out = new Uint8Array(local.length + cd.length + eocd.length);
  out.set(local, 0);
  out.set(cd, local.length);
  out.set(eocd, local.length + cd.length);
  return out;
}

export const bytes = (s: string): Uint8Array => new TextEncoder().encode(s);
