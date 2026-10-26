import { EDITOR_SCHEMA, SchemaUnknownError, assert_known_nodes } from "@ls/editor-schema/schema";
import type { ProseMirrorDoc as PMJson } from "@ls/editor-schema/schema";
import type { LessonId, Sha256, UnitId } from "@ls/schema/ids";
import { content_hash as hash_lesson } from "@ls/schema/content-hash";
import type { DraftBlock, LessonDraft } from "@ls/schema/lesson-draft";
import type { PMNode, Section, StoredLesson } from "@ls/schema/lesson";
import type { NormalizedRow } from "@ls/schema/outline";
import { assign_addresses, safety_note_id, section_slug, tip_address } from "./addresses.ts";
import * as N from "./nodes.ts";
import { plan_parts } from "./part-labels.ts";
import type { PartPlan, PartRemap } from "./part-labels.ts";
import { check_role } from "./roles.ts";
import type { SectionTemplate } from "./templates.ts";

export interface CompileContext {
  row: NormalizedRow;
  template: SectionTemplate;
  unit_id: UnitId;
  schema_version: number;
}

export interface CompiledLesson {
  lesson: StoredLesson;
  content_hash: Sha256;
  teacher_word_count: number;
  placeholders: number;
  safety_tips: string[];
  /** Descriptive or odd part labels the compiler mapped to Part A/B; diagnostics only. */
  part_remaps: PartRemap[];
}

export type CompileErrorReason = "section_not_in_template" | "role_not_allowed" | "unknown_node";

export class CompileError extends Error {
  readonly lesson_id: LessonId;
  readonly reason: CompileErrorReason;
  readonly address: string | null;
  constructor(init: { lesson_id: LessonId; reason: CompileErrorReason; address: string | null }) {
    super(`COMPILE_ERROR: ${init.reason} at ${init.address ?? init.lesson_id}`);
    this.name = "CompileError";
    this.lesson_id = init.lesson_id;
    this.reason = init.reason;
    this.address = init.address;
  }
}

const CALLOUTS = new Set(["callout_purpose", "callout_say", "callout_watch"]);

function build_nodes(
  blocks: readonly DraftBlock[],
  next_slot: () => string,
  tips: { id: (i: number) => string | null },
  plan: PartPlan,
): PMJson[] {
  const out: PMJson[] = [];
  const part_of = (b: DraftBlock): string | null => (b.part === null ? null : plan.label_of(b.part));
  const titled = new Set<string>();
  let prev_part: string | null = null;
  let tip_i = 0;
  for (let i = 0; i < blocks.length; ) {
    const b = blocks[i]!;
    const part = part_of(b);
    if (part !== null && part !== prev_part) {
      out.push(N.part_heading(part));
      const title = plan.title_of(part);
      if (title !== null && !titled.has(part)) {
        titled.add(part);
        out.push(...N.routine_title(title));
      }
    }
    prev_part = part;
    if (CALLOUTS.has(b.role)) {
      const run: DraftBlock[] = [];
      while (i < blocks.length && CALLOUTS.has(blocks[i]!.role) && part_of(blocks[i]!) === part) {
        run.push(blocks[i]!);
        i += 1;
      }
      out.push(N.eld_group(run));
      continue;
    }
    i += 1;
    switch (b.role) {
      case "routine_heading": out.push(...N.routine_heading(b)); break;
      case "teacher_talk": out.push(...N.teacher_talk(b)); break;
      case "sample_response": out.push(...N.sample_response(b)); break;
      case "support_table": out.push(...N.support_table(b)); break;
      case "cfu_item": out.push(...N.cfu_item(b)); break;
      case "quick_write": out.push(...N.quick_write(b)); break;
      case "text_evidence_needed": out.push(...N.text_evidence_needed(b, next_slot())); break;
      case "excerpt_slot": out.push(...N.excerpt_slot(b, next_slot())); break;
      case "teacher_tip": out.push(N.teacher_tip(b.text, tips.id(tip_i))); tip_i += 1; break;
      case "list": out.push(...N.list(b)); break;
      case "homework":
      case "paragraph": out.push(...N.plain(b)); break;
      default: break;
    }
  }
  return out;
}

function inline_text(n: PMNode): string {
  if (n.type === "text") return n.text ?? "";
  if (n.type === "hard_break") return " ";
  return (n.content ?? []).map(inline_text).join("");
}

function count_words(n: PMNode): number {
  if (n.type === "teacher_tip") return 0;
  const kids = n.content ?? [];
  const has_inline = kids.some((k) => k.type === "text" || k.type === "hard_break");
  if (has_inline) return (inline_text(n).match(/\S+/g) ?? []).length;
  return kids.reduce((s, k) => s + count_words(k), 0);
}

function count_placeholders(n: PMNode): number {
  const self = n.type === "quote_placeholder" || n.type === "excerpt_slot" ? 1 : 0;
  return (n.content ?? []).reduce((s, k) => s + count_placeholders(k), self);
}

export function compile_draft(draft: LessonDraft, ctx: CompileContext): CompiledLesson {
  const lesson_id = draft.lesson_id;
  const names = new Set(ctx.template.sections.map((s) => s.name));

  // 1. Validate everything first: no partial lesson.
  for (const b of draft.blocks) {
    const address = `${lesson_id}.${section_slug(b.section)}`;
    if (!names.has(b.section)) {
      throw new CompileError({ lesson_id, reason: "section_not_in_template", address });
    }
    if (check_role(b.role, b.section) === "role_not_allowed") {
      throw new CompileError({ lesson_id, reason: "role_not_allowed", address });
    }
  }

  // 2. Safety plan.
  const notes = ctx.row.segments.filter((s) => s.kind === "safety_note");
  const last = ctx.template.sections[ctx.template.sections.length - 1];
  const target =
    ctx.template.sections.find((s) => s.name === "Homework")?.name ?? last?.name ?? null;

  // 3. Per section.
  let slot_n = 0;
  const next_slot = (): string => {
    slot_n += 1;
    return `${lesson_id}.slot${slot_n}`;
  };
  const draft_sections: { name: string; minutes: number; doc: PMJson[] }[] = [];
  let tip_section: string | null = null;
  const part_remaps: PartRemap[] = [];
  for (const slot of ctx.template.sections) {
    const blocks = draft.blocks.filter((b) => b.section === slot.name);
    const is_target = slot.name === target;
    const tips = {
      id: (i: number): string | null =>
        is_target && i < notes.length ? safety_note_id(lesson_id, i + 1) : null,
    };
    const plan = plan_parts(slot.name, blocks.map((b) => b.part));
    part_remaps.push(...plan.remaps);
    const nodes = build_nodes(blocks, next_slot, tips, plan);
    if (is_target) {
      const paired = blocks.filter((b) => b.role === "teacher_tip").length;
      notes.forEach((note, i) => {
        if (i >= paired) nodes.push(N.teacher_tip(note.text, safety_note_id(lesson_id, i + 1)));
      });
      tip_section = slot.name;
    }
    if (nodes.length === 0) continue;
    draft_sections.push({
      name: slot.name,
      minutes: blocks.reduce((s, b) => s + (b.minutes ?? 0), 0),
      doc: nodes,
    });
  }

  // 6. Normalise.
  const sections: Section[] = draft_sections.map((s) => {
    const address = `${lesson_id}.${section_slug(s.name)}`;
    const doc: PMJson = { type: "doc", content: s.doc };
    try {
      assert_known_nodes(doc, ctx.schema_version);
    } catch (e) {
      if (e instanceof SchemaUnknownError) {
        throw new CompileError({ lesson_id, reason: "unknown_node", address });
      }
      throw e;
    }
    const node = EDITOR_SCHEMA.nodeFromJSON(doc);
    node.check();
    return { address: "", name: s.name, minutes: s.minutes, content: node.toJSON() as Section["content"] };
  });

  const lesson = assign_addresses(
    {
      lesson_id,
      schema_version: ctx.schema_version,
      title: draft.title,
      type: ctx.template.lesson_type,
      front_matter: {
        standards: [],
        minutes_total: sections.reduce((s, x) => s + x.minutes, 0),
        vocabulary: [...ctx.row.vocabulary],
      },
      sections,
      // Model-proposed record for the reviewer; not a grounding source (see checks/rules/grounding/sources.ts).
      text_cards: draft.text_cards,
    },
    ctx.unit_id,
  );

  const tip_addr = lesson.sections.find((s) => s.name === tip_section)?.address ?? null;
  const safety_tips = tip_addr === null ? [] : notes.map((_, i) => tip_address(tip_addr, i + 1));

  let teacher_word_count = 0;
  let placeholders = 0;
  for (const s of lesson.sections) {
    teacher_word_count += count_words(s.content as PMNode);
    placeholders += count_placeholders(s.content as PMNode);
  }
  return { lesson, content_hash: hash_lesson(lesson), teacher_word_count, placeholders, safety_tips, part_remaps };
}
