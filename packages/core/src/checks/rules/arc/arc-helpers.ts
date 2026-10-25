import type { StoredLesson } from "@ls/schema/lesson";
import { walk } from "../structural/doc-walk.ts";

/** Icon of the first routine heading in the lesson's first section, else null. */
export function opening_routine(lesson: StoredLesson): string | null {
  const first = lesson.sections[0];
  if (first === undefined) return null;
  let icon: string | null = null;
  walk(first.content, (n) => {
    if (icon === null && n.type === "routine_heading") {
      const v = n.attrs?.icon;
      if (typeof v === "string") icon = v;
    }
  });
  return icon;
}

/** Splits `G6.U4.L7` into prefix `G6.U4.L` and 7; flex days return null. */
export function lesson_number(
  id: string,
): { prefix: string; n: number } | null {
  const m = /^(.*\.L)(\d+)$/.exec(id);
  if (m === null) return null;
  return { prefix: m[1] ?? "", n: Number(m[2]) };
}

/** Page ranges named in a free-text string; null when none are found. */
export function parse_pages(s: string | null): Array<[number, number]> | null {
  if (s === null) return null;
  const out: Array<[number, number]> = [];
  const re = /\b(?:pages?|pp?\.)\s*(\d+)(?:\s*[-–—]\s*(\d+))?/gi;
  for (const m of s.matchAll(re)) {
    const a = Number(m[1]);
    const b = m[2] === undefined ? a : Number(m[2]);
    out.push(b < a ? [b, a] : [a, b]);
  }
  return out.length === 0 ? null : out;
}

export function ranges_overlap(
  a: Array<[number, number]>,
  b: Array<[number, number]>,
): boolean {
  return a.some(([a0, a1]) => b.some(([b0, b1]) => a0 <= b1 && b0 <= a1));
}
