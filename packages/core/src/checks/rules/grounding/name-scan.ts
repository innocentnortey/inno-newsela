import nlp from "compromise";
import { ALLOW, STARTERS } from "./allow-list.ts";

type Tok = { part: string; start: number; end: number; first: boolean };
type Cand = { start: number; end: number };
type Term = {
  text: string;
  tags: string[];
  offset: { start: number; length: number };
};
export type NameIndex = { S: Set<string>; L: Set<string> };

const PROPER = ["ProperNoun", "Person", "Place", "Organization"];
const ENTITY = ["Person", "Place", "Organization"];

function tokenize(text: string): Tok[] {
  const masked = text.replace(
    /\b(?:ELD|RL|RI|SL|W|L)\.[A-Za-z0-9.\-–]*[A-Za-z0-9]/g,
    (m) => " ".repeat(m.length),
  );
  const toks: Tok[] = [];
  for (const m of masked.matchAll(
    /[A-Za-zÀ-ÖØ-öø-ÿ][A-Za-zÀ-ÖØ-öø-ÿ’'-]*/g,
  )) {
    const w = m[0].replace(/(?:’s|'s|’|')$/, "");
    const base = m.index ?? 0;
    let off = 0;
    w.split("-").forEach((part, i) => {
      if (part.length > 0) {
        toks.push({
          part,
          start: base + off,
          end: base + off + part.length,
          first: i === 0,
        });
      }
      off += part.length + 1;
    });
  }
  return toks;
}

function is_sentence_initial(text: string, start: number): boolean {
  let i = start - 1;
  while (i >= 0 && " \t\"“‘'([{*_".includes(text.charAt(i))) i -= 1;
  if (i < 0) return true;
  if (".!?:;•–—\n".includes(text.charAt(i))) return true;
  const line_start = text.lastIndexOf("\n", start - 1) + 1;
  return /^\s*(?:[A-Da-d]|\d{1,2})[.)]\s+["“‘']?$/.test(
    text.slice(line_start, start),
  );
}

/** S: every source token (lowercased). L: tokens seen lowercase in sources or in the lesson's own text. */
export function build_name_index(
  source_texts: string[],
  field_texts: string[],
): NameIndex {
  const S = new Set<string>();
  const L = new Set<string>();
  const lower_start = /^[a-zà-öø-ÿ]/;
  for (const t of source_texts) {
    for (const k of tokenize(t)) {
      S.add(k.part.toLowerCase());
      if (lower_start.test(k.part)) L.add(k.part.toLowerCase());
    }
  }
  for (const t of field_texts) {
    for (const k of tokenize(t)) {
      if (lower_start.test(k.part)) L.add(k.part.toLowerCase());
    }
  }
  return { S, L };
}

function candidates(text: string, index: NameIndex): Cand[] {
  const out: Cand[] = [];
  for (const t of tokenize(text)) {
    if (!/^[A-ZÀ-ÖØ-Þ]/.test(t.part)) continue;
    if (t.part.length === 1 || /^[A-Z]{2,}$/.test(t.part)) continue;
    const w = t.part.toLowerCase();
    const si = t.first && is_sentence_initial(text, t.start);
    if (
      ALLOW.has(w) ||
      index.S.has(w) ||
      index.L.has(w) ||
      (si && STARTERS.has(w))
    )
      continue;
    out.push({ start: t.start, end: t.end });
  }
  return out;
}

function merge_and_dedupe(text: string, cands: Cand[]): string[] {
  const sorted = [...cands].sort((a, b) => a.start - b.start);
  const merged: Cand[] = [];
  for (const c of sorted) {
    const last = merged[merged.length - 1];
    if (last !== undefined && c.start - last.end === 1 && text.charAt(last.end) === " ")
      last.end = c.end;
    else merged.push({ start: c.start, end: c.end });
  }
  return [...new Set(merged.map((m) => text.slice(m.start, m.end)))];
}

/** Distinct capitalised names in `text` that no source (or lowercase use) accounts for. */
export function scan_names(text: string, index: NameIndex): string[] {
  const kept = candidates(text, index);
  const sentences = nlp(text).json({ offset: true }) as Array<{ terms: Term[] }>;
  const terms = sentences.flatMap((s) => s.terms);
  const proper = terms
    .filter(
      (t) =>
        t.tags.some((g) => PROPER.includes(g)) && !t.tags.includes("Honorific"),
    )
    .map((t) => [t.offset.start, t.offset.start + t.offset.length] as const);
  const result: Cand[] = kept.filter((c) =>
    proper.some(([a, b]) => c.start < b && c.end > a),
  );
  for (const t of terms) {
    if (!t.tags.some((g) => ENTITY.includes(g)) || t.tags.includes("Honorific"))
      continue;
    const s = t.offset.start;
    const e = s + t.offset.length;
    if (!/^[A-ZÀ-ÖØ-Þ]/.test(t.text.trim())) continue; // a name is capitalised
    if (!is_sentence_initial(text, s)) continue;
    if (result.some((c) => c.start < e && c.end > s)) continue;
    const w = t.text
      .replace(/[^A-Za-zÀ-ÿ'’-]/g, "")
      .replace(/(?:’s|'s)$/, "")
      .toLowerCase();
    if (w !== "" && !ALLOW.has(w) && !index.S.has(w)) {
      result.push({ start: s, end: s + w.length });
    }
  }
  return merge_and_dedupe(text, result);
}
