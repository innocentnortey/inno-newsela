// NL-90 support: phrases the product must never show (PRD GR-16: the tool assists writers, never replaces them).
export const BANNED_PHRASES: readonly string[] = [
  "ai replaces",
  "replaces writers",
  "replace writers",
  "no writers needed",
  "without writers",
  "writers are no longer",
  "instead of writers",
];

export function bannedIn(text: string): string[] {
  const t = text.toLowerCase();
  return BANNED_PHRASES.filter((p) => t.includes(p));
}
