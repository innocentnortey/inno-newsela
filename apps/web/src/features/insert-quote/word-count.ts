export const SHORT_QUOTE_LIMIT = 12;

/** Hint only: the server's CON-15 rule decides. Counts whitespace-separated tokens holding a letter or digit. */
export function countWords(text: string): number {
  return text.split(/\s+/).filter((t) => /[\p{L}\p{N}]/u.test(t)).length;
}
