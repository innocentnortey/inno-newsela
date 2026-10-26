// Independent oracles for the lifecycle tests. Expected evidence is derived from the DRAFT alone and observed evidence is parsed
// from the STORED lesson by a parser written here; neither imports the production standards view, tag codec or templates
// (generating the oracle from the production table would make both agree even when both are wrong).
import type { StoredLesson } from "@ls/schema/lesson";
import type { DraftLike } from "./drafts.ts";

export type Evidence = { kind: "teach" | "assess"; code: string; section: string };
const ev = (kind: Evidence["kind"], code: string, section: string): string => `${kind}|${code}|${section}`;

/** Sorted unique `${kind}|${code}|${section}` entries the draft declares: teaching headings, CFU codes, Quick Write codes. */
export function expected_evidence(d: DraftLike): string[] {
  const out = new Set<string>();
  for (const b of d.blocks) {
    if (b.role === "routine_heading") for (const c of b.standard_codes) out.add(ev("teach", c, b.section));
    else if (b.role === "cfu_item") {
      for (const c of (b.cfu?.standard_code ?? "").split(",").map((x) => x.trim()).filter((x) => x !== "")) out.add(ev("assess", c, b.section));
    } else if (b.role === "quick_write") for (const c of b.standard_codes) out.add(ev("assess", c, b.section));
  }
  return [...out].sort();
}

interface PM { type?: string; text?: string; attrs?: Record<string, unknown>; content?: PM[] }
const plain_text = (n: PM): string => (n.type === "text" ? (n.text ?? "") : (n.content ?? []).map(plain_text).join(""));
function walk(n: PM, fn: (n: PM) => void): void {
  fn(n);
  for (const c of n.content ?? []) walk(c, fn);
}

/** Same string form, parsed from the stored lesson: a routine heading "Label (CODE, CODE)" is evidence for each code. */
export function observed_evidence(l: StoredLesson): string[] {
  const out = new Set<string>();
  for (const s of l.sections) {
    walk(s.content as PM, (n) => {
      if (n.type !== "routine_heading") return;
      const m = /^(.*\S)\s*\(([^()]*)\)\s*$/.exec(plain_text(n));
      if (m === null) return;
      const label = m[1]!;
      const kind: Evidence["kind"] = n.attrs?.["icon"] === "cfu" || /^Quick Write/.test(label) ? "assess" : "teach";
      for (const c of m[2]!.split(",").map((x) => x.trim()).filter((x) => x !== "")) out.add(ev(kind, c, s.name));
    });
  }
  return [...out].sort();
}

export function structure_of(l: StoredLesson): Array<{ section: string; minutes: number; parts: string[] }> {
  return l.sections.map((s) => ({
    section: s.name,
    minutes: s.minutes as number,
    parts: ((s.content as PM).content ?? []).filter((n) => n.type === "heading" && n.attrs?.["level"] === 2).map((n) => plain_text(n).trim()),
  }));
}

export function standards_of(l: StoredLesson): Array<{ code: string; role: string; origin: string; confirmation: string }> {
  return l.front_matter.standards
    .filter((s) => s.role !== "eld")
    .map((s) => ({ code: s.code, role: s.role as string, origin: s.origin as string, confirmation: String(s.confirmation) }))
    .sort((a, b) => a.code.localeCompare(b.code));
}

export interface SlotView { type: string; slot_id: string | null; filled: boolean; rights: string | null; source_ref: string | null }
export function authority_of(l: StoredLesson): { slots: SlotView[]; text_cards: unknown[] } {
  const slots: SlotView[] = [];
  for (const s of l.sections) {
    walk(s.content as PM, (n) => {
      const slot_type = n.type === "quote_placeholder" || n.type === "excerpt_slot";
      if (!(slot_type || (n.type === "quote" && n.attrs?.["slot_id"] !== undefined))) return;
      const rights = typeof n.attrs?.["rights"] === "string" ? (n.attrs["rights"] as string) : null;
      const src = n.attrs?.["source_ref"];
      const source_ref = typeof src === "string" ? (src.trim() !== "" ? src : null) : src !== null && src !== undefined ? JSON.stringify(src) : null;
      slots.push({
        type: n.type!, slot_id: typeof n.attrs?.["slot_id"] === "string" ? (n.attrs["slot_id"] as string) : null,
        filled: rights !== null && rights !== "unset" && source_ref !== null, rights, source_ref,
      });
    });
  }
  return { slots, text_cards: l.text_cards as unknown[] };
}

export function fingerprint(l: StoredLesson) {
  return { structure: structure_of(l), evidence: observed_evidence(l), standards: standards_of(l), authority: authority_of(l) };
}

/** generation.ts NOT_ACTIONABLE_KINDS: findings generation deliberately does not act on. */
export const GENERATION_SUPPRESSED = ["quote_placeholder_open", "excerpt_slot_open", "cross_lesson_link"] as const;
export const HUMAN_WORK = new Set<string>([...GENERATION_SUPPRESSED, "rights_to_clear", "standard_confirmation", "suggestion_pending", "safety_flag_open"]);

export type Key = string;
export const key_of = (f: { kind: string; level: string; address: string | null; code?: string | null }): Key =>
  `${f.kind}|${f.level}|${f.address ?? ""}|${f.code ?? ""}`;
export const kind_of = (k: Key): string => k.split("|")[0]!;
/**
 * Unit-coverage advisory: arc_repeat's skill_unpractised ("assessed here but no lesson practises it") counts only role P, while derive_alignment
 * gives a code taught at one address role I. Since R-F3-8 the background check sees the lesson's own rows (as submit always did), so this
 * advisory is now reported consistently at every stage (assert_parity compares it exactly). It is advisory and about unit coverage, not about
 * the lesson's content, so the content oracles leave it out. Whether I should count as practice is a rule question, reported separately.
 */
const UNIT_COVERAGE_ADVISORY = "arc_repeat|advisory|";
export const core = (keys: Key[]): Key[] =>
  keys.filter((k) => !HUMAN_WORK.has(kind_of(k)) && !(k.startsWith(UNIT_COVERAGE_ADVISORY) && k.endsWith("|skill_unpractised"))).sort();

/** Every routine heading of the stored lesson: its icon and full text (tag included). */
export function headings_of(l: StoredLesson): Array<{ section: string; icon: string | null; text: string }> {
  const out: Array<{ section: string; icon: string | null; text: string }> = [];
  for (const s of l.sections) {
    walk(s.content as PM, (n) => {
      if (n.type === "routine_heading") out.push({ section: s.name, icon: (n.attrs?.["icon"] as string | undefined) ?? null, text: plain_text(n) });
    });
  }
  return out;
}
/** core() without advisories: what can stop a lesson. Advisories are information and are asserted by name where they occur. */
export const gating = (keys: Key[]): Key[] => core(keys).filter((k) => k.split("|")[1] !== "advisory");
