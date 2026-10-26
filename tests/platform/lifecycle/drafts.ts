// Synthetic draft builders for the lifecycle tests. Authority: docs/data/worked-pairs.md WP-1 (reading), WP-2 (writing: the
// writer task becomes one excerpt slot) and WP-3 "B" (flex day, U7: option (a) no standards, option (b) the generator proposes
// RL.6.7 with a blocking confirmation). Every builder returns a fresh object; the mutators never edit their input.
import { readFileSync } from "node:fs";
import { load_fixture } from "../../../apps/worker/test/support/world.ts";

export interface DraftBlock {
  role: string; section: string; part: string | null; text: string;
  standard_codes: string[]; code_origins: string[];
  cfu: { stem: string; options: string[]; key_index: number; rationales: string[]; standard_code: string | null } | null;
  minutes: number | null;
}
export interface DraftLike { lesson_id: string; title: string; text_cards: unknown[]; blocks: DraftBlock[] }

const FLEX = new URL("../../../evals/cases/drafts/_fixtures/good-wp-3.json", import.meta.url);

function strip_header(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(strip_header);
  if (v !== null && typeof v === "object") {
    return Object.fromEntries(Object.entries(v as Record<string, unknown>).filter(([k]) => !k.startsWith("_")).map(([k, x]) => [k, strip_header(x)]));
  }
  return v;
}

/** WP-3 "B" flex draft for a lesson id. `proposed_code` is the fixture as written (RL.6.7 added); `no_standards` clears every code. */
export function flex_draft(lesson_id: string, variant: "no_standards" | "proposed_code"): DraftLike {
  const d = strip_header(JSON.parse(readFileSync(FLEX, "utf8"))) as DraftLike;
  d.lesson_id = lesson_id;
  if (variant === "no_standards") {
    for (const b of d.blocks) {
      b.standard_codes = [];
      b.code_origins = [];
      if (b.cfu !== null) b.cfu.standard_code = null;
    }
  }
  return d;
}
export const wp1_draft = (): DraftLike => structuredClone(load_fixture("wp-1.json").draft) as DraftLike;
export const wp1_first_draft = (): DraftLike => structuredClone(load_fixture("wp-1.json").first_draft) as DraftLike;
export const wp2_draft = (): DraftLike => structuredClone(load_fixture("wp-2.json").draft) as DraftLike;

const first_cfu = (d: DraftLike): DraftBlock => {
  const b = d.blocks.find((x) => x.cfu !== null);
  if (b === undefined) throw new Error("draft has no block with a cfu");
  return b;
};

export function with_blank_rationale(d: DraftLike): DraftLike {
  const c = structuredClone(d);
  first_cfu(c).cfu!.rationales[1] = "";
  return c;
}
/** The same planted sentence as apps/worker/src/wiring/check-parity.test.ts `plant`. */
export function with_planted_name(d: DraftLike): DraftLike {
  const c = structuredClone(d);
  const r = first_cfu(c).cfu!.rationales;
  r[r.length - 1] += " The story never mentions Medusa on p. 999.";
  return c;
}
export function with_forged_card(d: DraftLike): DraftLike {
  const c = structuredClone(d);
  c.text_cards.push({ title: "The Lightning Thief", author: "Medusa", edition: null, chapter: "Chapter 999", pages: "p. 999", kind: "off-platform-text", content_available: false });
  return c;
}
export function without_excerpt_slot(d: DraftLike): DraftLike {
  const c = structuredClone(d);
  c.blocks = c.blocks.filter((b) => b.role !== "excerpt_slot");
  return c;
}
