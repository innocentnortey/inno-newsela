import type { CheckContext } from "../../types.ts";
import { extract_refs, type Range } from "./page-refs.ts";

export type Sources = {
  texts: string[];
  ranges: { page: Range[]; chapter: Range[] };
};

/**
 * What the lesson may quote, name or cite. Instruction-shaped row segments are not a source of truth
 * for quotes and names (an injected line must not legitimise what a model then writes); page and
 * chapter ranges still read them, because a real row often gives its pages in a "Focus" line.
 */
export function build_sources(ctx: CheckContext): Sources {
  const { row } = ctx;
  const texts: string[] = [];
  const range_texts: string[] = [];
  const add = (s: string | null | undefined): void => {
    if (typeof s === "string" && s.trim() !== "") texts.push(s);
  };
  add(row.title);
  add(row.homework);
  add(row.pages);
  add(row.text_set);
  add(row.arc);
  add(ctx.arc_header);
  for (const v of row.vocabulary) add(v);
  for (const seg of row.segments) {
    if (!seg.instruction_shaped) add(seg.text);
  }
  for (const c of ctx.text_cards) {
    add(c.title);
    add(c.author);
    add(c.edition);
    add(c.chapter);
    add(c.pages);
  }
  for (const s of ctx.standards) add(s.text);
  range_texts.push(...texts);
  const ranges: Sources["ranges"] = { page: [], chapter: [] };
  for (const t of range_texts) {
    for (const r of extract_refs(t)) ranges[r.kind].push({ from: r.from, to: r.to });
  }
  return { texts, ranges };
}
