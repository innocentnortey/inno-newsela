// NL-90 support: CSV/XLSX fixtures cut from the issued sample outline (later integration tickets import this).
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import * as XLSX from "xlsx";

const SAMPLE = resolve(__dirname, "../../../../../docs/data/samples/g6-u4-lesson-outline.json");

type Row = Record<string, unknown> & { row_kind?: string };

export function buildOutlineFixtures(rowIdx: number[], outDir: string): { csv: string; xlsx: string } {
  const sample = JSON.parse(readFileSync(SAMPLE, "utf8")) as { column_headers_row2: Record<string, string>; rows: Row[] };
  const keys = Object.keys(sample.column_headers_row2);
  const lessons = sample.rows.filter((r) => r.row_kind === "lesson");
  const picked = rowIdx.map((i) => {
    const r = lessons[i];
    if (!r) throw new Error(`no lesson row at index ${i}`);
    return r;
  });
  const aoa: string[][] = [
    keys.map((k) => sample.column_headers_row2[k] ?? k),
    ...picked.map((r) => keys.map((k) => String(r[k] ?? ""))),
  ];
  mkdirSync(outDir, { recursive: true });
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  const csvBody = XLSX.utils.sheet_to_csv(ws);
  const csv = join(outDir, "outline-fixture.csv");
  writeFileSync(csv, `# source: docs/data/samples/g6-u4-lesson-outline.json rows ${rowIdx.join(",")}\n${csvBody}`);
  const xlsx = join(outDir, "outline-fixture.xlsx");
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Lesson Outline");
  XLSX.writeFile(wb, xlsx);
  return { csv, xlsx };
}
