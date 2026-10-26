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

export type RationaleLabel = { letter: string | null; correct: boolean; body: string };

/** "B. Incorrect:" for option index 1; "A. Correct:" for index 0 when correct. The only writer of the label. */
export function rationale_label(index: number, correct: boolean): string {
  return `${String.fromCharCode(65 + index)}. ${correct ? CORRECT : INCORRECT}`;
}

/** Reads a CFU rationale paragraph's text. Returns null when the paragraph does not start with a rationale label. */
export function parse_rationale_label(paragraph_text: string): RationaleLabel | null {
  const m = /^\s*(?:([A-Za-z])[.)]\s*)?(Correct|Incorrect)\b/.exec(paragraph_text);
  if (m === null) return null;
  const body = paragraph_text.slice(m[0].length).replace(/^\s*[:.\-–—]?\s*/, "").trim();
  return { letter: m[1] ? m[1].toUpperCase() : null, correct: m[2] === "Correct", body };
}

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
