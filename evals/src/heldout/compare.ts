// NL-121: pure structural comparison of one generated lesson against one published lesson. No I/O, no logging.
import type { HeldoutReport, LessonCounts } from "./schema.ts";

export interface LessonFacts {
  type: string;
  sections: readonly string[];
  focus: readonly string[];
}

export class HeldoutEmpty extends Error {}

export const norm_type = (s: string): string => s.trim().toLowerCase();
// Published Research titles carry ": subtitle".
export const norm_section = (s: string): string => s.split(":")[0]!.trim().toLowerCase();

const round4 = (x: number): number => Math.round(x * 10000) / 10000;

function focus_set(codes: readonly string[]): Set<string> {
  const out = new Set<string>();
  for (const c of codes) {
    const t = c.trim().toUpperCase();
    if (t !== "") out.add(t);
  }
  return out;
}

export function compare_lesson(number: number, generated: LessonFacts, published: LessonFacts): LessonCounts {
  const gs = generated.sections.map(norm_section);
  const ps = published.sections.map(norm_section);
  const g = focus_set(generated.focus);
  const p = focus_set(published.focus);
  let shared = 0;
  for (const c of g) if (p.has(c)) shared++;
  const union = g.size + p.size - shared;
  return {
    number,
    type_match: norm_type(generated.type) === norm_type(published.type) ? 1 : 0,
    sequence_match: gs.length === ps.length && gs.every((s, i) => s === ps[i]) ? 1 : 0,
    sections_generated: gs.length,
    sections_published: ps.length,
    focus_generated: g.size,
    focus_published: p.size,
    focus_shared: shared,
    focus_jaccard: union === 0 ? 0 : round4(shared / union),
  };
}

export function build_report(generated_total: number, compared: readonly LessonCounts[], unreadable: number, no_published: number): HeldoutReport {
  if (compared.length === 0) throw new HeldoutEmpty("no lessons compared");
  const n = compared.length;
  const sum = (f: (c: LessonCounts) => number): number => compared.reduce((a, c) => a + f(c), 0);
  const type_match_count = sum((c) => c.type_match);
  const sequence_match_count = sum((c) => c.sequence_match);
  return {
    schema_version: 1,
    unit_grade: 6,
    unit_number: 4,
    lessons_generated: generated_total,
    lessons_compared: n,
    lessons_unreadable: unreadable,
    lessons_no_published: no_published,
    type_match_count,
    sequence_match_count,
    type_match_rate: round4(type_match_count / n),
    sequence_match_rate: round4(sequence_match_count / n),
    focus_jaccard_mean: round4(sum((c) => c.focus_jaccard) / n),
    focus_shared_total: sum((c) => c.focus_shared),
    focus_generated_total: sum((c) => c.focus_generated),
    focus_published_total: sum((c) => c.focus_published),
    per_lesson: [...compared],
  };
}
