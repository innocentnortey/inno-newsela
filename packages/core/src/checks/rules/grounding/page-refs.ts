export type Range = { from: number; to: number };
export type Ref = {
  kind: "page" | "chapter";
  from: number;
  to: number;
  match: string;
};

const UNITS = [
  "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve",
  "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen",
];
const TENS: Array<[string, number]> = [["twenty", 20], ["thirty", 30], ["forty", 40]];
const NUM_WORDS: Record<string, number> = {};
UNITS.forEach((w, i) => {
  NUM_WORDS[w] = i + 1;
});
for (const [t, v] of TENS) {
  NUM_WORDS[t] = v;
  if (v < 40) UNITS.slice(0, 9).forEach((w, i) => { NUM_WORDS[`${t}-${w}`] = v + i + 1; });
}
const NUM = `\\d{1,3}|${Object.keys(NUM_WORDS)
  .sort((x, y) => y.length - x.length)
  .join("|")}`;
const to_num = (s: string): number =>
  /^\d+$/.test(s) ? Number(s) : (NUM_WORDS[s.toLowerCase()] ?? 0);

export function extract_refs(text: string): Ref[] {
  const refs: Ref[] = [];
  const add = (
    kind: Ref["kind"],
    m: RegExpMatchArray,
    a: number,
    b: number | undefined,
  ): void => {
    let from = a;
    let to = b ?? a;
    if (to < from) [from, to] = [to, from];
    refs.push({ kind, from, to, match: m[0] });
  };
  // Residual (D-4): a page after "and" ("pages 8 and 999") is not read, because "pages 3 and 4 students" cannot be
  // told from a list without a word list.
  // A real row writes "pp. 224 ("A few minutes later,…")–233" and "pp. 219–top of 224": a bracketed quoted
  // phrase may sit between the first page and the dash, and "top of" may sit before the second page.
  const page_re =
    /\b(?:pp?\.|pages?)\s*(\d{1,4})(?:\s*\((?:[^()]|\([^()]*\))*\))?(?:\s*(?:[-–—]|to|through)\s*(?:(?:the\s+)?(?:top|bottom|middle|end|start)\s+of\s+)?(\d{1,4}))?/gi;
  for (const m of text.matchAll(page_re)) {
    add("page", m, Number(m[1]), m[2] ? Number(m[2]) : undefined);
  }
  // Chapter lists: "and", "&" and "," make separate chapters; "-", "to", "through" make a range. A later item
  // must use the same notation (digits or words) as the first, and "and one other text" is not a chapter.
  const item_src = `(${NUM})(?:\\s*(?:[-–—]|to|through)\\s*(${NUM}))?\\b`;
  const head_re = new RegExp(`\\b(?:chapters?|chs?)\\.?\\s*${item_src}`, "gi");
  const sep_re = new RegExp(`^\\s*(?:,\\s*(?:and\\s+|&\\s*)?|and\\s+|&\\s*)${item_src}`, "i");
  const other_re = /^\s+(?:other|another|more|additional|further)\b/i;
  const is_digits = (x: string): boolean => /^\d+$/.test(x);
  const matches = [...text.matchAll(head_re)];
  let resume = 0;
  for (const m of matches) {
    const start = m.index ?? 0;
    if (start < resume) continue;
    const items: Array<[number, number]> = [];
    const push = (a: string, b: string | undefined): void => {
      let from = to_num(a);
      let to = b !== undefined ? to_num(b) : from;
      if (to < from) [from, to] = [to, from];
      items.push([from, to]);
    };
    push(m[1] ?? "", m[2]);
    const digits = is_digits(m[1] ?? "");
    let end = start + m[0].length;
    for (;;) {
      const n = sep_re.exec(text.slice(end));
      if (n === null) break;
      const after = text.slice(end + n[0].length);
      if (is_digits(n[1] ?? "") !== digits || other_re.test(after)) break;
      push(n[1] ?? "", n[2]);
      end += n[0].length;
    }
    resume = end;
    const match = text.slice(start, end);
    for (const [from, to] of items) refs.push({ kind: "chapter", from, to, match });
  }
  return refs;
}

/** A card's own `pages` field is often just "224–233": a bare range counts as that card's pages. */
export function extract_bare_pages(text: string): Range | null {
  const m = /^\s*(\d{1,4})\s*(?:[-–—]\s*(\d{1,4}))?\s*$/.exec(text);
  if (m === null) return null;
  const a = Number(m[1]);
  const b = m[2] ? Number(m[2]) : a;
  return { from: Math.min(a, b), to: Math.max(a, b) };
}

/** False when the list is empty: a reference when the row names none is flagged. */
export function ref_in_range(ref: Ref, ranges: Range[]): boolean {
  if (ranges.length === 0) return false;
  const last = Math.min(ref.to, ref.from + 2000);
  for (let n = ref.from; n <= last; n += 1) {
    if (!ranges.some((r) => n >= r.from && n <= r.to)) return false;
  }
  return true;
}
