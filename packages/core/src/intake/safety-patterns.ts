/** Content-warning sentences addressed to the teacher. A hit is only ever *proposed* as a safety note (PD-26). */
export const SAFETY_PATTERNS: readonly RegExp[] = [
  /\bstudents?\b[^.\n]{0,80}\b(triggering|disturbing|upsetting|distressing|graphic|sensitive)\b/i,
  /\bpotentially (triggering|disturbing|upsetting)\b/i,
  /\bcontent warning\b/i,
];

const LEAD_VERB = /^[\s\W]*(warn|alert|notify|inform|tell|let|remind)/i;

export function is_safety_note_line(line: string): boolean {
  return LEAD_VERB.test(line) && SAFETY_PATTERNS.some((p) => p.test(line));
}
