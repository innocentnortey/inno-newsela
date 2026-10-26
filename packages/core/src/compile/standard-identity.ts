import { LESSON_ID_RE } from "@ls/schema/ids";
import type { LessonDraft } from "@ls/schema/lesson-draft";
import type { Standard } from "@ls/schema/lesson";
import type { NormalizedRow } from "@ls/schema/outline";
import type { StandardRow } from "../ports/standards.ts";

export type DraftOrigin = "outline" | "narrowed" | "added";
export type RowCodes = Pick<NormalizedRow, "focus_codes" | "eld_codes" | "msls_codes">;

const PLACEHOLDER = /^(?:n\s*\/\s*a|na|none|null|nil|tbd|no\s+codes?|not\s+applicable|[-–—]+)$/i;

/** Tokens that mean "no code". Never a claim about a standard. Tested before code shape: a lesson id is code-shaped. */
export function is_placeholder_code(token: string, lesson_id: string): boolean {
  const t = token.trim();
  return PLACEHOLDER.test(t) || t === lesson_id || LESSON_ID_RE.test(t);
}

/** "RL.6.1, RL.6.2" / "RL.6.1;RL.6.2" / ["RL.6.1"] / null -> trimmed distinct tokens in order. The only parser of cfu.standard_code. */
export function split_code_list(raw: string | readonly string[] | null | undefined): string[] {
  if (raw === null || raw === undefined) return [];
  const parts = (typeof raw === "string" ? [raw] : raw).flatMap((r) => r.split(/[,;]/));
  return [...new Set(parts.map((t) => t.trim()).filter((t) => t !== ""))];
}

/** split_code_list, then placeholders moved to `dropped`. */
export function clean_codes(
  raw: string | readonly string[] | null | undefined,
  lesson_id: string,
): { codes: string[]; dropped: string[] } {
  const codes: string[] = [];
  const dropped: string[] = [];
  for (const t of split_code_list(raw)) (is_placeholder_code(t, lesson_id) ? dropped : codes).push(t);
  return { codes, dropped };
}

export type CodeClass = { origin: DraftOrigin; role: Standard["role"]; resolved: boolean; replaces: string | null };

function listed_roles(row: RowCodes): Map<string, Standard["role"]> {
  const m = new Map<string, Standard["role"]>();
  for (const [codes, role] of [
    [row.focus_codes, "focus"],
    [row.msls_codes, "supporting"],
    [row.eld_codes, "eld"],
  ] as const) {
    for (const c of codes) if (!m.has(c)) m.set(c, role);
  }
  return m;
}

/** Origin from the pinned row and the official rows, never from the model. */
export function classify_code(code: string, row: RowCodes, catalogue: readonly StandardRow[]): CodeClass {
  const listed = listed_roles(row);
  const own = listed.get(code);
  if (own !== undefined) return { origin: "outline", role: own, resolved: true, replaces: null };
  const r = catalogue.find((x) => x.code === code);
  const parent_role = r?.is_leaf && r.parent_code !== null ? listed.get(r.parent_code) : undefined;
  if (r !== undefined && r.parent_code !== null && parent_role !== undefined) {
    return { origin: "narrowed", role: parent_role, resolved: true, replaces: r.parent_code };
  }
  const role: Standard["role"] =
    r?.set === "CA_ELD_6" ? "eld" : r?.set === "CA_CCSS_ELA_6" && row.focus_codes.length === 0 ? "focus" : "supporting";
  return { origin: "added", role, resolved: r !== undefined, replaces: null };
}

/**
 * Focus, then MSLS (supporting), then ELD from the row (a listed code with no official text is skipped); then the
 * tagged codes: a narrowed leaf replaces its parent in place; any other unlisted code is added. Both start with an open
 * confirmation and the generator as asserter. An unknown code is kept with empty text so the checks surface it.
 */
export function standards_for_lesson(
  row: RowCodes,
  catalogue: readonly StandardRow[],
  tagged: readonly string[],
): Standard[] {
  const text = new Map(catalogue.map((r) => [r.code, r.text]));
  const listed = listed_roles(row);
  const base: Standard[] = [];
  for (const [codes, role] of [
    [row.focus_codes, "focus"],
    [row.msls_codes, "supporting"],
    [row.eld_codes, "eld"],
  ] as const) {
    for (const code of codes) {
      const official_text = text.get(code);
      if (base.some((s) => s.code === code) || official_text === undefined) continue;
      base.push({ code, role, origin: "outline", official_text, asserted_by: "outline", confirmation: null });
    }
  }
  const narrowed = new Map<string, Standard[]>();
  const added: Standard[] = [];
  for (const code of new Set(tagged)) {
    if (listed.has(code)) continue;
    const c = classify_code(code, row, catalogue);
    const official_text = text.get(code) ?? "";
    if (c.origin === "narrowed" && c.replaces !== null) {
      const leaves = narrowed.get(c.replaces) ?? [];
      leaves.push({ code, role: c.role, origin: "narrowed", official_text, asserted_by: "generator", confirmation: "open" });
      narrowed.set(c.replaces, leaves);
    } else {
      added.push({ code, role: c.role, origin: "added", official_text, asserted_by: "generator", confirmation: "open" });
    }
  }
  const out: Standard[] = [];
  for (const s of base) out.push(...(narrowed.get(s.code) ?? [s]));
  // A narrowed parent that had no base entry (no official text) still needs its leaves recorded.
  for (const [parent, leaves] of narrowed) if (!base.some((s) => s.code === parent)) out.push(...leaves);
  return [...out, ...added];
}

export type IdentityNote = {
  kind: "placeholder_code_dropped" | "codes_on_uncarried_role" | "origin_claim_contradicts_row";
  section: string;
  block_index: number;
  code: string | null;
  detail: string;
};

const CODE_ROLES = new Set(["routine_heading", "quick_write", "cfu_item"]);

/** Catalogue-free checks of the draft's own claims against the pinned row. Details never contain draft text. */
export function identity_notes(draft: LessonDraft, row: RowCodes): IdentityNote[] {
  const listed = new Set([...row.focus_codes, ...row.eld_codes, ...row.msls_codes]);
  const notes: IdentityNote[] = [];
  draft.blocks.forEach((b, i) => {
    const at = { section: b.section, block_index: i };
    const tokens = [...b.standard_codes, ...split_code_list(b.cfu?.standard_code)];
    for (const t of tokens) {
      if (is_placeholder_code(t, draft.lesson_id)) {
        notes.push({ ...at, kind: "placeholder_code_dropped", code: t, detail: `role ${b.role} names a placeholder as a code` });
      }
    }
    if (b.standard_codes.length > 0 && !CODE_ROLES.has(b.role)) {
      notes.push({ ...at, kind: "codes_on_uncarried_role", code: null, detail: `role ${b.role} does not carry codes; compile ignores them` });
    }
    b.standard_codes.forEach((code, k) => {
      const claim = b.code_origins[k];
      if (claim === undefined || is_placeholder_code(code, draft.lesson_id)) return;
      if ((listed.has(code) && claim !== "outline") || (!listed.has(code) && claim === "outline")) {
        notes.push({ ...at, kind: "origin_claim_contradicts_row", code, detail: `role ${b.role} claims ${claim} for ${code}` });
      }
    });
  });
  return notes;
}
