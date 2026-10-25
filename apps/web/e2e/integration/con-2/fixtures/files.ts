// NL-93 fixtures: absolute paths to the issued sheets plus deterministic synthetic negative files.
import { resolve } from "node:path";
import * as XLSX from "xlsx";

const ROOT = resolve(__dirname, "../../../../../..");
const OUTLINE = resolve(ROOT, "packages/core/tests/fixtures/outline");
export const ISSUED_XLSX = resolve(OUTLINE, "issued.xlsx");
export const ISSUED_CSV = resolve(OUTLINE, "issued.csv");
export const SYN3_CSV = resolve(OUTLINE, "syn3-clean-control-row10.csv");
export const SYN2_CSV = resolve(
  ROOT,
  "docs/data/samples/synthetic-2026-10-24-syn2-layout-shifted.csv",
);
export const REPO_ROOT = ROOT;

export interface UploadFile {
  name: string;
  mimeType: string;
  buffer: Buffer;
}
export const XLSX_MIME =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

export function pdfRenamedXlsx(): UploadFile {
  const head = Buffer.from("%PDF-1.4\n");
  const filler = Buffer.from(
    "1 0 obj << /Type /Catalog >> endobj\n".repeat(20),
  );
  return {
    name: "outline.xlsx",
    mimeType: XLSX_MIME,
    buffer: Buffer.concat([head, filler]),
  };
}

export function oversizedXlsx(): UploadFile {
  const buf = Buffer.alloc(5 * 1024 * 1024 + 1);
  Buffer.from([0x50, 0x4b, 0x03, 0x04]).copy(buf);
  return { name: "big.xlsx", mimeType: XLSX_MIME, buffer: buf };
}

export function noHeaderCsv(): UploadFile {
  return {
    name: "no-header.csv",
    mimeType: "text/csv",
    buffer: Buffer.from("a,b,c\nd,e,f\ng,h,i\n"),
  };
}

export const HEADER_LABELS = [
  "Filename",
  "Lesson",
  "Lesson #",
  "Type of Lesson",
  "Days",
  "Text Dependent Question tied to the EQ",
  "Lesson Description",
  "Text Set Choice",
  "Homework",
  "Focus Standards (assessed)",
  "Additional Supported CA ELA Standards",
  "CA Media Literacy Standards",
  "Skill or content that will be needed for Performance Task",
  "Foundational Skills Focus",
  "Vocabulary",
  "Designated ELD Standards",
];

function csvFromRows(rows: string[][], name: string): UploadFile {
  const ws = XLSX.utils.aoa_to_sheet(rows);
  const buffer = Buffer.from(
    XLSX.write(
      { SheetNames: ["s"], Sheets: { s: ws } },
      { type: "buffer", bookType: "csv" },
    ),
  );
  return { name, mimeType: "text/csv", buffer };
}

export function tooManyRowsCsv(): UploadFile {
  const rows: string[][] = [HEADER_LABELS];
  for (let n = 1; n <= 201; n++) {
    const r = HEADER_LABELS.map(() => "");
    r[0] = `L${n}_ELA_TE_G6_U4_CA_Core`;
    r[1] = "Investigation 1";
    r[2] = `Lesson ${n}`;
    r[3] = "Core Reading";
    r[4] = "1.0";
    rows.push(r);
  }
  return csvFromRows(rows, "too-many.csv");
}

// One valid header and one lesson row whose description is markup: the screens must show it as text, never run it.
export function markupCsv(): UploadFile {
  const r = HEADER_LABELS.map(() => "");
  r[0] = "L1_ELA_TE_G6_U4_CA_Core";
  r[1] = "Investigation 1";
  r[2] = "Lesson 1";
  r[3] = "Core Reading";
  r[4] = "1.0";
  r[6] = "<img src=x onerror=alert(1)>";
  const title = HEADER_LABELS.map(() => "");
  title[0] = "G6, U4: The Lightning Thief by Rick Riordan\nISBN 9780786838653";
  return csvFromRows([title, HEADER_LABELS, r], "markup.csv");
}
