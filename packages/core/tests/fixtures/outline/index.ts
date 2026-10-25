// Loaders for the outline fixtures. Only fixture code reads files; src/intake never does.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parse_workbook } from "../../../src/intake/parse-grid.ts";
import type { CellGrid } from "../../../src/intake/parse-grid.ts";

const HERE = import.meta.dirname;
const SAMPLES = resolve(HERE, "../../../../../docs/data/samples");
const read = (p: string): Uint8Array => new Uint8Array(readFileSync(p));

export const load_issued_grid = (): CellGrid => parse_workbook(read(resolve(HERE, "issued.csv")), "csv");
export const load_issued_xlsx_bytes = (): Uint8Array => read(resolve(HERE, "issued.xlsx"));
export const load_syn1_grid = (): CellGrid => parse_workbook(read(resolve(HERE, "syn1-injection-row09.csv")), "csv");
export const load_syn3_grid = (): CellGrid => parse_workbook(read(resolve(HERE, "syn3-clean-control-row10.csv")), "csv");

/**
 * SYN-2 as shipped has a blank total row (its Days formula value was not captured), and the parser drops
 * trailing blank records. The displayed value of the sheet's SUM formula is appended so the total row exists.
 */
export function load_syn2_grid(): CellGrid {
  const grid = parse_workbook(read(resolve(SAMPLES, "synthetic-2026-10-24-syn2-layout-shifted.csv")), "csv");
  const width = grid.rows[0]?.length ?? 16;
  const total = new Array<string>(width).fill("");
  total[4] = "47.0"; // Days column; position is unchanged by SYN-2's H/I swap
  return { rows: [...grid.rows, total], sheet_name: grid.sheet_name };
}

/** Title row, header row and only the listed sheet rows (1-based), from the issued grid. */
export function grid_from_rows(sheet_rows: number[]): CellGrid {
  const g = load_issued_grid();
  const rows = [g.rows[0] ?? [], g.rows[1] ?? [], ...sheet_rows.map((n) => g.rows[n - 1] ?? [])];
  return { rows, sheet_name: g.sheet_name };
}
