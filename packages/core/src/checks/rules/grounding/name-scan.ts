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

/**
 * A rationale or option label ("B. Incorrect: ") is a label, not part of the sentence. Left in place it makes the
 * tagger read the capitalised first word after the colon ("Switching", "Nothing", "Too") as a proper noun. Blank it
 * with spaces (offsets stay the same) so that word is an ordinary sentence start. A name later in the sentence,
 * mid-sentence and capitalised, is still scanned as before.
 *
 * The first word after a stripped label is a sentence start, so the sentence-initial pass alone would miss an
 * invented name there ("B. Incorrect: Medusa would wait."). `label_first_words` + `first_word_is_name` decide it
 * by the word's class when written in lower case: a function or inflected word (pronoun, determiner, gerund,
 * adverb...) or a common word the tagger's own lexicon knows is not a name; anything else stays a candidate and is
 * checked against the sources and the lesson's own text like every other candidate. No word list is added.
 *
 * Known residual (2026-10-26, see docs/testing/error-analysis/name-scan-residual-2026-10-26.md): a capitalised plain
 * noun that is the first word after a label, is in no source, and appears in lower case nowhere in the lesson (Length,
 * Preference, Describes) cannot be told from an invented name by the tagger and is flagged. It stays blocking in CFU
 * text: Medusa, Brindle and Quillon fall in the same class and must stay caught. Policy: repair is told the exact
 * word; a reviewer can resolve it; no word list.
 */
const OPTION_LABEL = /(^|\n)(\s*(?:[A-Za-z][.)]\s+)?(?:Correct|Incorrect)\s*[:.\-–—]\s*)/g;
export function blank_option_labels(text: string): string {
  return text.replace(OPTION_LABEL, (_m, lead: string, label: string) => lead + " ".repeat(label.length));
}

const FUNCTION_TAGS = [
  "Pronoun", "Determiner", "Preposition", "Conjunction", "Adverb", "Adjective", "Gerund", "Verb", "Infinitive",
  "Modal", "Auxiliary", "Value", "Possessive", "Copula", "QuestionWord", "Negative",
];
const NAME_LEXICON_TAGS = ["Person", "FirstName", "LastName", "MaleName", "FemaleName", "Place", "Country", "City", "Region", "Organization", "ProperNoun"];
type Lex = Record<string, string | undefined>;
const lexicon = (): Lex => (nlp as unknown as { world(): { model: { one: { lexicon: Lex } } } }).world().model.one.lexicon;

/** Position of the first word after each label in `raw_text`, with the rest of its line (for tagging in context). */
function label_first_words(raw_text: string): Array<{ start: number; end: number; line_rest: string }> {
  const out: Array<{ start: number; end: number; line_rest: string }> = [];
  for (const m of raw_text.matchAll(OPTION_LABEL)) {
    const from = (m.index ?? 0) + m[0].length;
    const w = /^[A-Za-zÀ-ÖØ-öø-ÿ][A-Za-zÀ-ÖØ-öø-ÿ’']*/.exec(raw_text.slice(from));
    if (w === null) continue;
    const nl = raw_text.indexOf("\n", from);
    out.push({ start: from, end: from + w[0].length, line_rest: raw_text.slice(from, nl === -1 ? undefined : nl) });
  }
  return out;
}

/** Decide by the word's class in lower case whether a capitalised word right after a label may be a name. */
function first_word_is_name(word: string, line_rest: string): boolean {
  const lower = line_rest.charAt(0).toLowerCase() + line_rest.slice(1);
  const sentences = nlp(lower).json({ offset: true }) as Array<{ terms: Term[] }>;
  const tags = sentences[0]?.terms[0]?.tags ?? [];
  if (tags.some((g) => PROPER.includes(g))) return true;
  if (tags.some((g) => FUNCTION_TAGS.includes(g))) return false;
  const known = lexicon()[word.toLowerCase().replace(/(?:’s|'s)$/, "")];
  return known === undefined || NAME_LEXICON_TAGS.includes(known);
}

/** Distinct capitalised names in `text` that no source (or lowercase use) accounts for. */
export function scan_names(raw_text: string, index: NameIndex): string[] {
  const text = blank_option_labels(raw_text);
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
  for (const f of label_first_words(raw_text)) {
    const word = raw_text.slice(f.start, f.end);
    const w = word.replace(/(?:’s|'s)$/, "").toLowerCase();
    if (!/^[A-ZÀ-ÖØ-Þ]/.test(word) || word.length === 1 || /^[A-Z]{2,}$/.test(word)) continue;
    if (ALLOW.has(w) || STARTERS.has(w) || index.S.has(w) || index.L.has(w)) continue;
    if (result.some((c) => c.start < f.end && c.end > f.start)) continue;
    if (first_word_is_name(word, f.line_rest)) result.push({ start: f.start, end: f.end });
  }
  return merge_and_dedupe(text, result);
}
