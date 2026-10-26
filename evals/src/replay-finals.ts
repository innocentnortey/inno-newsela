// Offline replay (NL-134 follow-up): pure helpers for re-checking stored model outputs on the current code. No database,
// no model call. The reader in replay-finals-main.ts feeds these; this file imports nothing from the project so it can be
// copied into a worktree of an older commit for a baseline run.

export type StoredCall = { purpose: string; raw_output: string | null };
export type Which = "initial" | "final";
export type ReplayFinding = { kind: string; level: string; message: string; address: string | null; code: string | null; matched?: string };
export type ReplayRecord = {
  lesson: string;
  which: Which;
  status: string;
  schema_issues: string[];
  compile_error: string | null;
  gen: ReplayFinding[] | null;
  review: ReplayFinding[] | null;
};

/** initial = the first lesson_draft output; final = the last lesson_draft or repair output. Calls without output are skipped. */
export function pick_output(calls: readonly StoredCall[], which: Which): string | null {
  const usable = calls.filter((c) => (c.purpose === "lesson_draft" || c.purpose === "repair") && c.raw_output !== null);
  if (which === "initial") return usable.find((c) => c.purpose === "lesson_draft")?.raw_output ?? null;
  return usable.length === 0 ? null : (usable[usable.length - 1]?.raw_output ?? null);
}

export type KindCounts = Record<string, { blocking: number; other: number; lessons: number }>;
export type Summary = {
  lessons: number;
  not_compiled: number;
  gen_pass: number;
  review_pass: number;
  gen_blocking: KindCounts;
  review_blocking: KindCounts;
};

function tally(sets: readonly (readonly ReplayFinding[])[]): KindCounts {
  const out: KindCounts = {};
  for (const fs of sets) {
    const seen = new Set<string>();
    for (const f of fs) {
      const e = (out[f.kind] ??= { blocking: 0, other: 0, lessons: 0 });
      if (f.level === "blocking") e.blocking += 1; else e.other += 1;
      if (!seen.has(f.kind)) { seen.add(f.kind); e.lessons += 1; }
    }
  }
  return out;
}

const blocking = (fs: readonly ReplayFinding[] | null): boolean => (fs ?? []).some((f) => f.level === "blocking");

/** A lesson passes a gate when it compiled and the gate raised no blocking finding. */
export function summarize(records: readonly ReplayRecord[]): Summary {
  const compiled = records.filter((r) => r.gen !== null);
  return {
    lessons: records.length,
    not_compiled: records.length - compiled.length,
    gen_pass: compiled.filter((r) => !blocking(r.gen)).length,
    review_pass: compiled.filter((r) => !blocking(r.review)).length,
    gen_blocking: tally(compiled.map((r) => (r.gen ?? []).filter((f) => f.level === "blocking"))),
    review_blocking: tally(compiled.map((r) => (r.review ?? []).filter((f) => f.level === "blocking"))),
  };
}

/** Per-kind change in lessons raising a blocking finding, new minus baseline. */
export function delta(base: KindCounts, now: KindCounts): Record<string, number> {
  const out: Record<string, number> = {};
  for (const k of new Set([...Object.keys(base), ...Object.keys(now)])) {
    const d = (now[k]?.lessons ?? 0) - (base[k]?.lessons ?? 0);
    if (d !== 0) out[k] = d;
  }
  return out;
}

type Block = { role?: string; section?: string; part?: string | null; text?: string; standard_codes?: string[]; code_origins?: string[]; cfu?: null; minutes?: number | null };

/**
 * What-if for drafts written before the prompt asked for tags on routine headings: copy the codes a teacher_talk or
 * paragraph block carries onto the routine_heading that opens its section and part, adding a bare heading when the model
 * wrote none. Returns the JSON text unchanged when it does not parse. It estimates what is left once a model follows the
 * heading instruction; it says nothing about whether it will.
 */
export function lift_teaching_tags(raw: string): string {
  let d: { blocks?: Block[] };
  try { d = JSON.parse(raw) as { blocks?: Block[] }; } catch { return raw; }
  if (!Array.isArray(d.blocks)) return raw;
  const out: Block[] = [];
  let heading: Block | null = null;
  for (const b of d.blocks) {
    if (b.role === "routine_heading") { heading = b; out.push(b); continue; }
    if (heading !== null && (heading.section !== b.section || (heading.part ?? null) !== (b.part ?? null))) heading = null;
    const codes = b.standard_codes ?? [];
    if ((b.role === "teacher_talk" || b.role === "paragraph") && codes.length > 0) {
      if (heading === null) {
        heading = { role: "routine_heading", section: b.section ?? "", part: b.part ?? null, text: "Routine", standard_codes: [], code_origins: [], cfu: null, minutes: null };
        out.push(heading);
      }
      const have = heading.standard_codes ??= [];
      const have_o = heading.code_origins ??= [];
      codes.forEach((c, i) => { if (!have.includes(c)) { have.push(c); have_o.push((b.code_origins ?? [])[i] ?? "outline"); } });
    }
    out.push(b);
  }
  return JSON.stringify({ ...d, blocks: out });
}
