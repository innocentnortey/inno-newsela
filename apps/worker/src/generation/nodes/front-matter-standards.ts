import type { Standard } from "@ls/schema/lesson";
import type { NormalizedRow } from "@ls/schema/outline";
import type { StandardRow } from "@ls/core/ports/standards";

/** Focus, then MSLS (supporting), then ELD; de-duplicated; codes without an official text are skipped. */
export function build_front_matter_standards(row: NormalizedRow, rows: readonly StandardRow[]): Standard[] {
  const text = new Map(rows.map((r) => [r.code, r.text]));
  const seen = new Set<string>();
  const out: Standard[] = [];
  const add = (codes: readonly string[], role: Standard["role"]): void => {
    for (const code of codes) {
      const official_text = text.get(code);
      if (seen.has(code) || official_text === undefined) continue;
      seen.add(code);
      out.push({ code, role, origin: "outline", official_text, asserted_by: "outline", confirmation: null });
    }
  };
  add(row.focus_codes, "focus");
  add(row.msls_codes, "supporting");
  add(row.eld_codes, "eld");
  return out;
}
