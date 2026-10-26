import type { CheckContext } from "../../types.ts";
import { extract_bare_pages, extract_refs, type Range } from "./page-refs.ts";

export type SourceOrigin = "outline_row" | "arc_header" | "standard";
export type SourceEntry = { origin: SourceOrigin; text: string };
export type Sources = {
  entries: SourceEntry[];
  texts: string[];
  ranges: { page: Range[]; chapter: Range[] };
};

/**
 * What the lesson may quote, name or cite: the pinned outline row, its arc header and official standards text.
 * A text card in the lesson is written by the model and never widens this set. Instruction-shaped row segments are not a source of truth
 * for quotes and names (an injected line must not legitimise what a model then writes); page and
 * chapter ranges still read them, because a real row often gives its pages in a "Focus" line.
 */
export function build_sources(ctx: CheckContext): Sources {
  const { row } = ctx;
  const entries: SourceEntry[] = [];
  const add = (origin: SourceOrigin, s: string | null | undefined): void => {
    if (typeof s === "string" && s.trim() !== "") entries.push({ origin, text: s });
  };
  add("outline_row", row.title);
  add("outline_row", row.homework);
  add("outline_row", row.pages);
  add("outline_row", row.text_set);
  add("outline_row", row.arc);
  add("arc_header", ctx.arc_header);
  for (const v of row.vocabulary) add("outline_row", v);
  for (const seg of row.segments) {
    if (!seg.instruction_shaped) add("outline_row", seg.text);
  }
  for (const s of ctx.standards) add("standard", s.text);
  const texts = entries.map((e) => e.text);
  const ranges: Sources["ranges"] = { page: [], chapter: [] };
  for (const t of texts) {
    for (const r of extract_refs(t)) ranges[r.kind].push({ from: r.from, to: r.to });
  }
  // The outline row's `pages` cell is the only stated page range. A text card is written by the model and is never a source.
  const bare = typeof row.pages === "string" ? extract_bare_pages(row.pages) : null;
  if (bare !== null) ranges.page.push(bare);
  return { entries, texts, ranges };
}
