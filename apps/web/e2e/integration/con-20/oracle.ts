// NL-99 oracle: expected merged active seconds from the script alone. Never reads the database.
// Rules (CON-20): a beat counts when focused, visible and input within 60 s; beats under 10 s apart in one tab add
// nothing; one user is one session across tabs (merged), the first active beat opens it at 0 s, each later active
// beat adds the gap to the previous one when the gap is at most 60 s.
import { events, IDLE_S, S8, type Segment, type Who } from "./script";

export const MIN_SPACING_S = 10;
export const MERGE_GAP_S = 60;

export function expectedUserSeconds(seg: Segment, who: Who): number {
  const kept = new Map<string, number>();
  const beats = events(seg)
    .filter((e) => e.who === who)
    .filter((e) => e.focused && e.visible && e.last_input_age <= IDLE_S)
    .filter((e) => {
      const prev = kept.get(e.tab);
      if (prev !== undefined && e.t - prev < MIN_SPACING_S) return false;
      kept.set(e.tab, e.t);
      return true;
    });
  let last: number | null = null;
  let total = 0;
  for (const b of beats) {
    if (last !== null && b.t > last) {
      const d = b.t - last;
      if (d <= MERGE_GAP_S) total += d;
    }
    last = Math.max(last ?? 0, b.t);
  }
  return total;
}

export function expectedLessonSeconds(seg: Segment): number {
  return (["A", "B"] as const).reduce((s, w) => s + expectedUserSeconds(seg, w), 0);
}

// An idle tab adds at most one minute, whatever the script says.
export function idleCeilingSeconds(): number {
  return IDLE_S;
}

export const expectedLessons = (): Record<number, number> =>
  Object.fromEntries(S8.map((s) => [s.lesson, expectedLessonSeconds(s)]));
