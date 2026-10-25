import { read, utils } from "xlsx";
import { IntakeError } from "./errors.ts";

export type SheetKind = "csv" | "xlsx";
export interface CellGrid {
  rows: string[][];
  sheet_name: string;
}
export interface ParseLimits {
  max_bytes: number;
  max_cells: number;
  max_cols: number;
  max_cell_chars: number;
  max_zip_entries: number;
  max_zip_uncompressed_bytes: number;
}

export const DEFAULT_PARSE_LIMITS: ParseLimits = {
  max_bytes: 5_242_880,
  max_cells: 20_000,
  max_cols: 60,
  max_cell_chars: 32_767,
  max_zip_entries: 100,
  max_zip_uncompressed_bytes: 52_428_800,
};

const BAD_NAMES = new Set(["__proto__", "constructor", "prototype"]);

function refuse(reason: string, extra: Record<string, number> = {}): never {
  throw new IntakeError("UNSUPPORTED_FILE", { reason, ...extra });
}

function starts_with(data: Uint8Array, sig: number[]): boolean {
  return sig.every((b, i) => data[i] === b);
}

/** Parse an uploaded CSV or XLSX into a rectangular grid of text. Untrusted input: every refusal is an IntakeError with no cell text. */
export function parse_workbook(data: Uint8Array, kind: SheetKind, limits?: Partial<ParseLimits>): CellGrid {
  const lim: ParseLimits = { ...DEFAULT_PARSE_LIMITS, ...limits };
  if (kind !== "csv" && kind !== "xlsx") refuse("not_csv_or_xlsx");
  if (data.byteLength === 0) refuse("empty");
  // Size cap first: it bounds memory and time for everything below, including both parsers.
  if (data.byteLength > lim.max_bytes) refuse("too_large", { bytes: data.byteLength, max_bytes: lim.max_bytes });

  const head = data.subarray(0, 8);
  if (starts_with(head, [0x25, 0x50, 0x44, 0x46])) refuse("not_csv_or_xlsx");
  const is_zip = starts_with(head, [0x50, 0x4b, 0x03, 0x04]);
  const is_ole = starts_with(head, [0xd0, 0xcf, 0x11, 0xe0]);
  if (kind === "xlsx") {
    if (!is_zip) refuse("not_csv_or_xlsx");
    inspect_zip(data, lim);
    return parse_xlsx(data, lim);
  }
  if (is_zip || is_ole) refuse("not_csv_or_xlsx");
  if (data.subarray(0, 8192).includes(0)) refuse("not_csv_or_xlsx");
  return parse_csv(data, lim);
}

function finish(rows: string[][]): string[][] {
  while (rows.length > 0 && (rows[rows.length - 1] ?? []).every((c) => c === "")) rows.pop();
  if (rows.length === 0) refuse("empty");
  const width = rows.reduce((m, r) => Math.max(m, r.length), 0);
  return rows.map((r) => (r.length < width ? [...r, ...new Array<string>(width - r.length).fill("")] : r));
}

function parse_csv(data: Uint8Array, lim: ParseLimits): CellGrid {
  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true, ignoreBOM: false }).decode(data);
  } catch {
    return refuse("not_csv_or_xlsx");
  }
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  if (/^[\s\u00a0]*$/.test(text)) refuse("empty");

  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let in_quotes = false;
  let was_quoted = false; // current field began with a quote
  let cells = 0;

  const end_field = (): void => {
    row.push(field);
    cells++;
    if (cells > lim.max_cells || row.length > lim.max_cols) refuse("too_large");
    field = "";
    was_quoted = false;
  };
  const end_row = (): void => {
    end_field();
    rows.push(row);
    row = [];
  };

  const n = text.length;
  for (let i = 0; i < n; i++) {
    const ch = text[i] as string;
    if (in_quotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          in_quotes = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"' && field === "" && !was_quoted) {
      in_quotes = true;
      was_quoted = true;
    } else if (ch === ",") {
      end_field();
    } else if (ch === "\n") {
      end_row();
    } else if (ch === "\r") {
      if (text[i + 1] === "\n") i++;
      end_row();
    } else {
      field += ch;
    }
    if (field.length > lim.max_cell_chars) refuse("too_large");
  }
  if (in_quotes) refuse("not_csv_or_xlsx");
  if (field !== "" || row.length > 0 || was_quoted) end_row();
  return { rows: finish(rows), sheet_name: "" };
}

/** Walks the zip central directory using declared sizes only; nothing is inflated before the budget is checked. */
function inspect_zip(data: Uint8Array, lim: ParseLimits): void {
  const len = data.byteLength;
  const view = new DataView(data.buffer, data.byteOffset, len);
  let eocd = -1;
  for (let i = len - 22; i >= Math.max(0, len - 22 - 65_535); i--) {
    if (view.getUint32(i, true) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) refuse("not_csv_or_xlsx");
  const entries = view.getUint16(eocd + 10, true);
  const cd_offset = view.getUint32(eocd + 16, true);
  if (entries > lim.max_zip_entries) refuse("too_large", { entries });
  if (cd_offset >= len) refuse("not_csv_or_xlsx");
  let pos = cd_offset;
  let total = 0;
  for (let e = 0; e < entries; e++) {
    if (pos + 46 > len || view.getUint32(pos, true) !== 0x02014b50) refuse("not_csv_or_xlsx");
    const usize = view.getUint32(pos + 24, true);
    const name_len = view.getUint16(pos + 28, true);
    const extra_len = view.getUint16(pos + 30, true);
    const comment_len = view.getUint16(pos + 32, true);
    if (pos + 46 + name_len > len) refuse("not_csv_or_xlsx");
    if (usize === 0xffffffff) refuse("too_large");
    total += usize;
    if (total > lim.max_zip_uncompressed_bytes) refuse("too_large", { uncompressed: total });
    const name = new TextDecoder("latin1").decode(data.subarray(pos + 46, pos + 46 + name_len));
    if (name.includes("..") || name.startsWith("/") || name.startsWith("\\")) refuse("not_csv_or_xlsx");
    pos += 46 + name_len + extra_len + comment_len;
  }
}

function parse_xlsx(data: Uint8Array, lim: ParseLimits): CellGrid {
  let wb: ReturnType<typeof read>;
  try {
    wb = read(data, {
      type: "array",
      cellFormula: false,
      cellHTML: false,
      cellNF: false,
      cellStyles: false,
      cellDates: false,
      bookVBA: false,
      bookFiles: false,
      bookProps: false,
      bookSheets: false,
      sheetStubs: false,
      sheets: 0,
      sheetRows: 2001,
    });
  } catch {
    return refuse("not_csv_or_xlsx");
  }
  const names = wb.SheetNames ?? [];
  if (names.some((nm) => BAD_NAMES.has(nm.trim().toLowerCase()))) refuse("not_csv_or_xlsx");
  const name = names[0];
  if (name === undefined) return refuse("empty");
  const ws = Object.hasOwn(wb.Sheets, name) ? wb.Sheets[name] : undefined;
  if (!ws) return refuse("empty");

  // The declared range is checked before any row is materialised.
  const ref = ws["!fullref"] ?? ws["!ref"];
  if (!ref) return refuse("empty");
  const range = utils.decode_range(ref);
  const cols = range.e.c - range.s.c + 1;
  const nrows = range.e.r - range.s.r + 1;
  if (cols > lim.max_cols || nrows * cols > lim.max_cells) refuse("too_large", { cols, rows: nrows });

  const raw = utils.sheet_to_json<unknown[]>(ws, { header: 1, raw: false, defval: "", blankrows: true });
  const rows: string[][] = [];
  for (const r of raw) {
    const out: string[] = [];
    for (const v of r) {
      const s = String(v ?? "");
      if (s.length > lim.max_cell_chars) refuse("too_large");
      out.push(s);
    }
    rows.push(out);
  }
  return { rows: finish(rows), sheet_name: name };
}
