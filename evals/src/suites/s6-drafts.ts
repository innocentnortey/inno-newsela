// NL-107: a healthy stub draft for any generatable lesson of the issued grid, derived from the WP-2 fixture (synthetic).
// The fixture's non-CFU blocks are kept for the sections the row's lesson-type template has; one CFU item per focus
// code replaces the fixture's CFU items, so the standards checks have something to find. The fixture's own code tags
// belong to another lesson, so they are stripped; the row's focus codes are tagged on a teaching routine heading in
// Learning in Action (contract correction: S6 stub draft generator, astra slice D).
import { template_for } from "@ls/core/compile/templates";
import type { StubScriptItem } from "@ls/llm/stub";
import type { NormalizedRow } from "@ls/schema/outline";
import { lesson_of, load_fixture, text } from "./s6-world.ts";

type Block = { role: string; section: string; part: string | null; text: string; standard_codes: string[]; code_origins: string[]; cfu: unknown; minutes: number | null };
const base = load_fixture("wp-2.json").draft as { lesson_id: string; title: string; text_cards: unknown[]; blocks: Block[] };

function cfu_block(code: string | null): Block {
  return {
    role: "cfu_item", section: "Learning in Action", part: "Part B", standard_codes: code === null ? [] : [code], code_origins: code === null ? [] : ["outline"], minutes: null,
    text: "Check for understanding.",
    cfu: {
      stem: code === null ? "Which choice best shows the skill practised today?" : `Which choice best shows the skill named by ${code}?`,
      options: ["The choice that applies the skill to the text.", "A choice about page numbers.", "A choice about the cover.", "A choice about the title."],
      key_index: 0,
      rationales: ["Correct: It applies the skill.", "Incorrect: It is unrelated.", "Incorrect: It is unrelated.", "Incorrect: It is unrelated."],
      standard_code: code,
    },
  };
}

// Quotation marks around a title read as a quoted passage that no source contains (grounding trusts only the outline row).
const unquote = (t: string): string => t.replace(/(^|[\s(])'([^']+)'(?=[\s).,;:?!]|$)/g, "$1$2");

/** The draft JSON for one outline row. */
export function draft_for(row: NormalizedRow): unknown {
  const template = template_for(row.lesson_type);
  const names = new Set((template?.sections ?? []).map((s) => s.name));
  const kept = base.blocks
    .filter((b) => b.role !== "cfu_item" && names.has(b.section))
    .map((b) => ({ ...b, standard_codes: [] as string[], code_origins: [] as string[], minutes: null as number | null, text: unquote(b.text.replace(/pages? \d+(-\d+)?/gi, "the pages")) }));
  // Section minutes are the sum of block minutes: put each template section's minutes on its first block.
  for (const slot of template?.sections ?? []) {
    const first = kept.find((b) => b.section === slot.name);
    if (first) first.minutes = slot.minutes;
  }
  // The row's own focus codes are taught under one tagged routine heading that opens Learning in Action.
  const lia = kept.findIndex((b) => b.section === "Learning in Action");
  if (row.focus_codes.length > 0 && lia >= 0) {
    const part = kept[lia]!.part;
    const teaching: Block[] = [
      { role: "routine_heading", section: "Learning in Action", part, text: "Teach the skill", standard_codes: [...row.focus_codes], code_origins: row.focus_codes.map(() => "outline"), cfu: null, minutes: null },
      { role: "teacher_talk", section: "Learning in Action", part, text: "Say: Let us practise the skill together.", standard_codes: [], code_origins: [], cfu: null, minutes: null },
    ];
    kept.splice(lia, 0, ...teaching);
  }
  // A flex day names no focus code but the template still needs a CFU item: it carries no code.
  const codes: (string | null)[] = row.focus_codes.length > 0 ? row.focus_codes : [null];
  return { lesson_id: row.lesson_id, title: `${row.title}`.slice(0, 120) || "Lesson", text_cards: base.text_cards, blocks: [...kept, ...codes.map(cfu_block)] };
}

/** Script function for the draft and repair purposes: a healthy draft for the lesson the request names. */
export function make_healthy(rows: readonly NormalizedRow[]): (req: { user_blocks: ReadonlyArray<{ text: string }> }) => StubScriptItem {
  return (req) => {
    const id = lesson_of(req);
    const row = rows.find((r) => r.lesson_id === id);
    if (!row) throw new Error("stub draft: no outline row for lesson " + JSON.stringify(id));
    return text(draft_for(row));
  };
}
