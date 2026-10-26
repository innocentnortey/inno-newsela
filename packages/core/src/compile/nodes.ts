import type { ProseMirrorDoc as PMJson } from "@ls/editor-schema/schema";
import type { DraftBlock } from "@ls/schema/lesson-draft";
import {
  ELD_LABEL, PULSE_CHECK, QUICK_WRITE, SUPPORT_HEADERS, SUPPORT_LABEL,
  TEACHER_LABELS, rationale_label, routine_icon,
} from "./labels.ts";
import { normalise_part_label } from "./addresses.ts";
import { format_tag } from "./standard-tags.ts";

type MarkName = "strong" | "em" | "teacher_talk" | "sample_response";

export function text(s: string, marks: readonly MarkName[] = []): PMJson {
  const n: PMJson = { type: "text", text: s };
  if (marks.length > 0) n.marks = marks.map((type) => ({ type }));
  return n;
}

export function para(s: string, marks: readonly MarkName[] = []): PMJson {
  return s === "" ? { type: "paragraph" } : { type: "paragraph", content: [text(s, marks)] };
}

export function paras(s: string, marks: readonly MarkName[] = []): PMJson[] {
  const lines = s.split(/\n+/).map((l) => l.trim()).filter((l) => l !== "");
  return lines.length === 0 ? [{ type: "paragraph" }] : lines.map((l) => para(l, marks));
}

export function routine_heading(block: DraftBlock): PMJson[] {
  return [{ type: "routine_heading", attrs: { icon: routine_icon(block.text) }, content: [text(format_tag(block.text, block.standard_codes))] }];
}

export function teacher_talk(block: DraftBlock): PMJson[] {
  const out = paras(block.text, ["teacher_talk"]);
  const first = out[0];
  const first_text = first?.content?.[0]?.text;
  if (first && first_text !== undefined) {
    const label = TEACHER_LABELS.find((l) => first_text.startsWith(l));
    if (label) {
      const rest = first_text.slice(label.length);
      first.content = [
        text(label, ["strong", "teacher_talk"]),
        ...(rest === "" ? [] : [text(rest, ["teacher_talk"])]),
      ];
    }
  }
  return out;
}

export function sample_response(block: DraftBlock): PMJson[] {
  return paras(block.text, ["sample_response"]);
}

export function plain(block: DraftBlock): PMJson[] {
  return paras(block.text);
}

export function list(block: DraftBlock): PMJson[] {
  const lines = block.text.split(/\n+/).map((l) => l.trim().replace(/^(?:[-*•])\s+/, "")).filter((l) => l !== "");
  if (lines.length === 0) return [{ type: "paragraph" }];
  return [{ type: "bullet_list", content: lines.map((l) => ({ type: "list_item", content: [para(l)] })) }];
}

const VARIANT_ORDER = ["purpose", "say", "watch"] as const;

export function eld_group(blocks: readonly DraftBlock[]): PMJson {
  const variant = (b: DraftBlock): (typeof VARIANT_ORDER)[number] =>
    b.role === "callout_purpose" ? "purpose" : b.role === "callout_say" ? "say" : "watch";
  const sorted = [...blocks].sort((a, b) => VARIANT_ORDER.indexOf(variant(a)) - VARIANT_ORDER.indexOf(variant(b)));
  return {
    type: "collapsible",
    attrs: { label: ELD_LABEL },
    content: sorted.map((b) => ({ type: "callout", attrs: { variant: variant(b) }, content: paras(b.text) })),
  };
}

const CELL_ATTRS = { colspan: 1, rowspan: 1, colwidth: null };

export function support_table(block: DraftBlock): PMJson[] {
  const cell = (type: "table_cell" | "table_header", s: string): PMJson => ({
    type,
    attrs: { ...CELL_ATTRS },
    content: [para(s)],
  });
  const rows: PMJson[] = [
    { type: "table_row", content: SUPPORT_HEADERS.map((h) => cell("table_header", h)) },
  ];
  for (const line of block.text.split(/\n+/).map((l) => l.trim()).filter((l) => l !== "")) {
    const i = line.indexOf("|");
    const a = i < 0 ? line : line.slice(0, i).trim();
    const b = i < 0 ? "" : line.slice(i + 1).trim();
    rows.push({ type: "table_row", content: [cell("table_cell", a), cell("table_cell", b)] });
  }
  return [
    { type: "collapsible", attrs: { label: SUPPORT_LABEL }, content: [{ type: "table", content: rows }] },
  ];
}

export function cfu_item(block: DraftBlock): PMJson[] {
  const c = block.cfu;
  if (c === null) return [];
  const out: PMJson[] = [
    { type: "routine_heading", attrs: { icon: "cfu" }, content: [text(c.standard_code === null || c.standard_code.trim() === "" ? PULSE_CHECK : `${PULSE_CHECK} (${c.standard_code.trim()})`)] },
    para(c.stem),
    {
      type: "ordered_list",
      attrs: { order: 1, type: "A" },
      content: c.options.map((o) => ({ type: "list_item", content: [para(o)] })),
    },
  ];
  c.options.forEach((_, i) => {
    out.push({
      type: "paragraph",
      content: [text(rationale_label(i, i === c.key_index), ["strong"]), text(` ${c.rationales[i] ?? ""}`)],
    });
  });
  return out;
}

export function quick_write(block: DraftBlock): PMJson[] {
  return [
    { type: "routine_heading", attrs: { icon: "writing" }, content: [text(format_tag(QUICK_WRITE, block.standard_codes))] },
    ...paras(block.text),
  ];
}

export function text_evidence_needed(block: DraftBlock, slot_id: string): PMJson[] {
  return [{ type: "quote_placeholder", attrs: { slot_id, reason: block.text } }];
}

export function excerpt_slot(block: DraftBlock, slot_id: string): PMJson[] {
  return [
    ...paras(block.text),
    { type: "excerpt_slot", attrs: { slot_id, rights: "unset", source_ref: null } },
  ];
}

export function teacher_tip(text_value: string, safety_note_id: string | null): PMJson {
  return { type: "teacher_tip", attrs: { safety_note_id }, content: paras(text_value) };
}

export function part_heading(label: string): PMJson {
  return { type: "heading", attrs: { level: 2 }, content: [text(normalise_part_label(label))] };
}

export function routine_title(title: string): PMJson[] {
  return [{ type: "routine_heading", attrs: { icon: routine_icon(title) }, content: [text(title.trim())] }];
}
