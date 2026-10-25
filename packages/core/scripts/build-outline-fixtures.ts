// Deterministic builder for the outline fixtures. Run: npx tsx packages/core/scripts/build-outline-fixtures.ts
// Inputs are the synthetic/issued samples under docs/data/samples; outputs go to packages/core/tests/fixtures/outline.
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { utils, write } from "xlsx";

const ROOT = resolve(import.meta.dirname, "../../..");
const SAMPLES = resolve(ROOT, "docs/data/samples");
const OUT = resolve(import.meta.dirname, "../tests/fixtures/outline");

interface SampleRow { sheet_row: number; row_kind?: string; [k: string]: unknown }
interface Sample { title_cell_A1: string; column_headers_row2: Record<string, string>; rows: SampleRow[] }

const load = (name: string): Sample => JSON.parse(readFileSync(resolve(SAMPLES, name), "utf8")) as Sample;

function cell(v: unknown): string {
  if (v === undefined || v === null) return "";
  if (typeof v === "number") return Number.isInteger(v) ? v.toFixed(1) : String(v);
  return String(v);
}

function build_grid(replace?: string): string[][] {
  const base = load("g6-u4-lesson-outline.json");
  const keys = Object.keys(base.column_headers_row2);
  const width = keys.length;
  const grid: string[][] = [];
  const title = new Array<string>(width).fill("");
  title[0] = base.title_cell_A1;
  grid[0] = title;
  grid[1] = keys.map((k) => base.column_headers_row2[k] ?? "");
  const days_col = keys.indexOf("days");
  const put = (r: SampleRow): void => {
    // days_formula (=SUM(E4:E56)) is never written; the total row carries the sheet's displayed value instead.
    grid[r.sheet_row - 1] = keys.map((k) => cell(r[k]));
  };
  for (const r of base.rows) put(r);
  if (replace) for (const r of load(replace).rows) put(r);
  for (let i = 0; i < grid.length; i++) grid[i] ??= new Array<string>(width).fill("");
  // Total row: the displayed value of the Days formula = sum of the Days column above it.
  const total = base.rows.find((r) => r.row_kind === "total_row");
  if (total) {
    let sum = 0;
    for (let i = 2; i < total.sheet_row - 1; i++) sum += Number((grid[i] ?? [])[days_col] || 0);
    (grid[total.sheet_row - 1] as string[])[days_col] = sum.toFixed(1);
  }
  return grid;
}

function to_csv(rows: string[][]): string {
  const q = (s: string) => (/[",\r\n]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s);
  return rows.map((r) => r.map(q).join(",")).join("\n") + "\n";
}

function to_xlsx(rows: string[][]): Uint8Array {
  const ws = utils.aoa_to_sheet([]);
  rows.forEach((r, ri) =>
    r.forEach((v, ci) => {
      if (v !== "") ws[utils.encode_cell({ r: ri, c: ci })] = { t: "s", v };
    }),
  );
  ws["!ref"] = utils.encode_range({ s: { r: 0, c: 0 }, e: { r: rows.length - 1, c: (rows[0]?.length ?? 1) - 1 } });
  const wb = utils.book_new();
  wb.Props = { CreatedDate: new Date("2026-10-24T00:00:00Z"), ModifiedDate: new Date("2026-10-24T00:00:00Z") };
  utils.book_append_sheet(wb, ws, "Lesson Outline");
  return new Uint8Array(write(wb, { type: "array", bookType: "xlsx" }) as ArrayBuffer);
}

const issued = build_grid();
writeFileSync(resolve(OUT, "issued.csv"), to_csv(issued));
writeFileSync(resolve(OUT, "issued.xlsx"), to_xlsx(issued));
writeFileSync(resolve(OUT, "syn1-injection-row09.csv"), to_csv(build_grid("synthetic-2026-10-24-syn1-injection-row09.json")));
writeFileSync(resolve(OUT, "syn3-clean-control-row10.csv"), to_csv(build_grid("synthetic-2026-10-24-syn3-clean-control-row10.json")));
console.log("outline fixtures written");
