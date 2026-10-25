export type Range = { from: number; to: number };
export type Ref = {
  kind: "page" | "chapter";
  from: number;
  to: number;
  match: string;
};

const NUM_WORDS: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8,
  nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14,
  fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19,
  twenty: 20, "twenty-one": 21, "twenty-two": 22,
};
const NUM =
  "\\d{1,3}|twenty-one|twenty-two|twenty|nineteen|eighteen|seventeen|sixteen|fifteen|fourteen|thirteen|twelve|eleven|ten|nine|eight|seven|six|five|four|three|two|one";
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
  const page_re =
    /\b(?:pp?\.|pages?)\s*(\d{1,4})(?:\s*(?:[-–—]|to|through)\s*(\d{1,4}))?/gi;
  for (const m of text.matchAll(page_re)) {
    add("page", m, Number(m[1]), m[2] ? Number(m[2]) : undefined);
  }
  const ch_re = new RegExp(
    `\\b(?:chapters?|chs?)\\.?\\s*(${NUM})(?:\\s*(?:[-–—]|to|through|and|&)\\s*(${NUM}))?`,
    "gi",
  );
  for (const m of text.matchAll(ch_re)) {
    add("chapter", m, to_num(m[1] ?? ""), m[2] ? to_num(m[2]) : undefined);
  }
  return refs;
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
