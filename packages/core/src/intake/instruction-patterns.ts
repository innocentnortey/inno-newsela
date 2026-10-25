/**
 * Phrases that read like an instruction to a model rather than lesson content. A match only flags the
 * segment (`instruction_shaped`); the text is never removed or rewritten. No `g` flag, so `.test` is stateless.
 */
export const INSTRUCTION_PATTERNS: readonly RegExp[] = [
  /\b(ignore|disregard|override)\b[^.\n]{0,40}\b(rules?|instructions?|prompts?|above|previous|prior|guidelines?|constraints?)\b/i,
  /\bforget (everything|all|what)\b/i,
  /\bsystem prompt\b/i,
  /\byou (must|are now|will now)\b/i,
  /\b(new|updated) instructions?\b/i,
  /\b(quote|reproduce|print|reveal)\b[^.\n]{0,30}\b(in full|verbatim|word for word|entire|full text)\b/i,
  /\bquote\s+(chapter|ch\.)\s*\d+/i,
  /\bas an? (ai|language model|assistant)\b/i,
];

export function is_instruction_shaped(text: string): boolean {
  return INSTRUCTION_PATTERNS.some((p) => p.test(text));
}
