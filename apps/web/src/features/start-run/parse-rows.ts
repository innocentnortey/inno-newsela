export type RowsParse = { ok: true; rows: number[] } | { ok: false; message: string };

/** Parses "8, 9, 25". `valid === null` means the report is not loaded: skip the membership check, the server enforces it. */
export function parseRows(text: string, valid: ReadonlySet<number> | null): RowsParse {
  const tokens = text.split(/[\s,]+/).filter((t) => t !== "");
  if (tokens.length === 0) return { ok: false, message: "Enter at least one row, like 8, 9, 25" };
  if (tokens.some((t) => !/^\d+$/.test(t))) {
    return { ok: false, message: "Rows are numbers separated by commas, like 8, 9, 25" };
  }
  const rows = [...new Set(tokens.map(Number))];
  if (valid) {
    const bad = rows.filter((r) => !valid.has(r));
    if (bad.length === 1) return { ok: false, message: `Row ${bad[0]} isn't a teaching day in this outline` };
    if (bad.length > 1) return { ok: false, message: `Rows ${bad.join(", ")} aren't teaching days in this outline` };
  }
  return { ok: true, rows };
}
