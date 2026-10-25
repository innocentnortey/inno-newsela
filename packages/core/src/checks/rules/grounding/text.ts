export type QuoteSpan = { inner: string; start: number; end: number };

const EDGE = ".,;:!?…()[]";

export function normalize_for_match(s: string): string {
  let t = s.normalize("NFKC");
  t = t.replace(/[“”"‘’'`]/g, "");
  t = t.replace(/[–—‑‐]/g, "-");
  t = t.replace(/\s+/g, " ").toLowerCase().trim();
  let prev = "";
  while (prev !== t) {
    prev = t;
    while (t.length > 0 && EDGE.includes(t.charAt(0))) t = t.slice(1);
    while (t.length > 0 && EDGE.includes(t.charAt(t.length - 1)))
      t = t.slice(0, -1);
    t = t.trim();
  }
  return t;
}

/** Whitespace-separated tokens that contain a letter or a digit. */
export function count_words(s: string): number {
  return s.split(/\s+/u).filter((w) => /[\p{L}\p{N}]/u.test(w)).length;
}

export function find_quote_spans(text: string): QuoteSpan[] {
  const patterns = [
    /“([^”]{1,400})”/g,
    /"([^"]{1,400})"/g,
    /‘(.{1,400}?)’(?![A-Za-z])/g,
    /(?<![A-Za-z0-9])'(.{1,400}?)'(?![A-Za-z0-9])/g,
  ];
  const found: QuoteSpan[] = [];
  for (const re of patterns) {
    for (const m of text.matchAll(re)) {
      const start = m.index ?? 0;
      const end = start + m[0].length;
      if (found.some((f) => start < f.end && end > f.start)) continue;
      found.push({ inner: m[1] ?? "", start, end });
    }
  }
  return found.sort((a, b) => a.start - b.start);
}
