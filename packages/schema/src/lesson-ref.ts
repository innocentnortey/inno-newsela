import { LESSON_ID_RE, type LessonId } from "./ids.ts";

const SHORT_FORM = /^g(\d{1,2})-u(\d{1,2}):(L\d{1,3}|FLEX-\d{1,2}[a-z]?)$/;

/** Accepts the canonical id (`G6.U4.L4`) or the short form (`g6-u4:L4`); null when neither. */
export function parse_lesson_ref(raw: string): LessonId | null {
  if (LESSON_ID_RE.test(raw)) return raw;
  const m = SHORT_FORM.exec(raw);
  if (m === null) return null;
  return `G${m[1]}.U${m[2]}.${m[3]}`;
}
