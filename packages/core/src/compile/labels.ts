/** The only text the compiler may add to a lesson (GR-2: no invented text). */
export type IconName =
  | "cfu"
  | "notes_section"
  | "writing"
  | "graphic_organizer"
  | "academic_discussion"
  | "personal_dictionary"
  | "reading";

export const ELD_LABEL = "Integrated ELD Instructions";
export const SUPPORT_LABEL = "Additional Student Support";
export const SUPPORT_HEADERS: readonly [string, string] = ["Situation", "Try this"];
export const PULSE_CHECK = "Pulse Check";
export const QUICK_WRITE = "Quick Write";
export const CORRECT = "Correct:";
export const INCORRECT = "Incorrect:";
/** Longest first, so "Say these Directions:" wins over "Say:". */
export const TEACHER_LABELS: readonly string[] = ["Say these Directions:", "Say:", "Ask:"];

export const ALL_LABELS: readonly string[] = [
  ELD_LABEL,
  SUPPORT_LABEL,
  ...SUPPORT_HEADERS,
  PULSE_CHECK,
  QUICK_WRITE,
  CORRECT,
  INCORRECT,
  ...TEACHER_LABELS,
];

const ICON_RULES: readonly (readonly [readonly string[], IconName])[] = [
  [["quick write"], "writing"],
  [["pulse check", "check for understanding"], "cfu"],
  [["think-pair-share", "turn and talk"], "academic_discussion"],
  [["language study"], "notes_section"],
];

export function routine_icon(text: string): IconName {
  const t = text.trim().toLowerCase();
  for (const [prefixes, icon] of ICON_RULES) {
    if (prefixes.some((p) => t.startsWith(p))) return icon;
  }
  return "notes_section";
}
