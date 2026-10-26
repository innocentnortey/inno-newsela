import type { Standard } from "@ls/schema/lesson";
import type { NormalizedRow } from "@ls/schema/outline";
import type { StandardRow } from "@ls/core/ports/standards";

/**
 * Focus, then MSLS (supporting), then ELD; de-duplicated; listed codes without an official text are skipped.
 * `tagged` are the codes the compiled headings name. Origin is decided here from the row, never from the model:
 * a tagged leaf of a listed parent is a narrowing that replaces the parent; any other unlisted tagged code is added.
 * Both start with an open confirmation and the generator as asserter. An unknown code is kept with empty text so
 * the checks surface it instead of dropping it.
 */
export function build_front_matter_standards(
  row: NormalizedRow,
  rows: readonly StandardRow[],
  tagged: readonly string[] = [],
): Standard[] {
  const text = new Map(rows.map((r) => [r.code, r.text]));
  const listed_role = new Map<string, Standard["role"]>();
  const base: Standard[] = [];
  const add = (codes: readonly string[], role: Standard["role"]): void => {
    for (const code of codes) {
      if (!listed_role.has(code)) listed_role.set(code, role);
      const official_text = text.get(code);
      if (base.some((s) => s.code === code) || official_text === undefined) continue;
      base.push({ code, role, origin: "outline", official_text, asserted_by: "outline", confirmation: null });
    }
  };
  add(row.focus_codes, "focus");
  add(row.msls_codes, "supporting");
  add(row.eld_codes, "eld");

  const narrowed = new Map<string, Standard[]>(); // parent code -> narrowed leaves, in tag order
  const added: Standard[] = [];
  for (const code of new Set(tagged)) {
    if (listed_role.has(code)) continue;
    const r = rows.find((x) => x.code === code);
    const parent_role = r?.is_leaf && r.parent_code !== null ? listed_role.get(r.parent_code) : undefined;
    if (r !== undefined && r.parent_code !== null && parent_role !== undefined) {
      const leaves = narrowed.get(r.parent_code) ?? [];
      leaves.push({
        code, role: parent_role, origin: "narrowed", official_text: r.text, asserted_by: "generator", confirmation: "open",
      });
      narrowed.set(r.parent_code, leaves);
      continue;
    }
    const role: Standard["role"] =
      r?.set === "CA_ELD_6" ? "eld" : r?.set === "CA_CCSS_ELA_6" && row.focus_codes.length === 0 ? "focus" : "supporting";
    added.push({
      code, role, origin: "added", official_text: r?.text ?? "", asserted_by: "generator", confirmation: "open",
    });
  }
  const out: Standard[] = [];
  for (const s of base) out.push(...(narrowed.get(s.code) ?? [s]));
  // A narrowed parent that had no base entry (no official text) still needs its leaves recorded.
  for (const [parent, leaves] of narrowed) if (!base.some((s) => s.code === parent)) out.push(...leaves);
  return [...out, ...added];
}
