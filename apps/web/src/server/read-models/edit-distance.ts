// NL-104: pure token edit distance for tile V-4 (draft to approved). No I/O.
export const EDIT_TOKEN_CAP = 600;

function tokens(s: string): string[] {
  return s.split(/\s+/).filter((t) => t !== "").slice(0, EDIT_TOKEN_CAP);
}

/** Token-level Levenshtein distance divided by the longer token count (0 = identical, 1 = nothing shared). */
export function normalized_edit_distance(a: string, b: string): number {
  const x = tokens(a);
  const y = tokens(b);
  const longest = Math.max(x.length, y.length);
  if (longest === 0) return 0;
  let prev = Array.from({ length: y.length + 1 }, (_, j) => j);
  for (let i = 1; i <= x.length; i++) {
    const cur = new Array<number>(y.length + 1);
    cur[0] = i;
    for (let j = 1; j <= y.length; j++) {
      const sub = prev[j - 1]! + (x[i - 1] === y[j - 1] ? 0 : 1);
      cur[j] = Math.min(sub, prev[j]! + 1, cur[j - 1]! + 1);
    }
    prev = cur;
  }
  return prev[y.length]! / longest;
}
