import type { PMNode, StoredLesson } from "@ls/schema/lesson";
import type { CheckContext } from "../../types.ts";
import { MAX_CODES_PER_CHECK } from "../../../compile/standard-tags.ts";
import { read_evidence } from "./evidence.ts";
import type { EvidenceActivity, EvidenceItem } from "./evidence.ts";
import { find_cfu_items, node_text, visit_with_parts, walk } from "../structural/doc-walk.ts";

type Standard = StoredLesson["front_matter"]["standards"][number];

export const FRONT = (ctx: CheckContext): string => `${ctx.lesson.lesson_id}.FrontMatter`;

export function recorded(ctx: CheckContext): Standard[] {
  return ctx.lesson.front_matter.standards.filter((s) => s.confirmation !== "removed");
}

export function listed_codes(ctx: CheckContext): Set<string> {
  return new Set([
    ...ctx.allowed_codes,
    ...ctx.row.focus_codes,
    ...ctx.row.eld_codes,
    ...ctx.row.msls_codes,
  ]);
}

export function focus_codes(ctx: CheckContext): string[] {
  const listed = ctx.row.focus_codes;
  // A recorded leaf below a listed parent refines it: the parent is the one to check.
  const extra = recorded(ctx)
    .filter((s) => s.role === "focus")
    .map((s) => s.code)
    .filter((c) => !listed.some((l) => c.startsWith(`${l}.`)));
  return [...new Set([...listed, ...extra])];
}

export type CfuTag = { code: string; address: string };

/** Pulse Check items by code (S3's observer imports this); unsubstantiated items are included. */
export function cfu_tags(ctx: CheckContext): CfuTag[] {
  return read_evidence(ctx.lesson)
    .filter((e) => e.activity === "pulse_check")
    .map((e) => ({ code: e.code, address: e.address }));
}

/** A parent code is covered by a tag naming it, or a recorded leaf below it. */
export function covered(f: string, tags: CfuTag[], recorded_codes: Set<string>): boolean {
  return tags.some(
    (t) => t.code === f || (t.code.startsWith(`${f}.`) && recorded_codes.has(t.code)),
  );
}

/** Addresses (part or section) with at least one teaching paragraph, in the named sections. */
function teaching_text_addresses(lesson: StoredLesson, names: readonly string[]): string[] {
  const found: string[] = [];
  for (const section of lesson.sections) {
    if (!names.includes(section.name)) continue;
    const excluded = new Set<PMNode>();
    for (const item of find_cfu_items(section)) {
      excluded.add(item.heading);
      for (const b of item.blocks) walk(b, (n) => excluded.add(n));
    }
    visit_with_parts(section, ({ node }) => {
      if (node.type === "teacher_tip") walk(node, (n) => excluded.add(n));
      else if (node.type === "collapsible") walk(node, (n) => excluded.add(n));
    });
    visit_with_parts(section, ({ node, address }) => {
      if (
        node.type === "paragraph" &&
        !excluded.has(node) &&
        node_text(node).trim() !== "" &&
        !found.includes(address)
      ) {
        found.push(address);
      }
    });
  }
  return found;
}

/**
 * S3's "any teaching part" observation and the judge seed: paragraphs only, Literacy Lab and Learning in Action.
 * Production evidence (evidence.ts) also counts Launch and Say callouts and is per routine. The difference is
 * intentional; S3 is the stricter observer here.
 */
export function teaching_parts(lesson: StoredLesson): string[] {
  return teaching_text_addresses(lesson, ["Literacy Lab", "Learning in Action"]);
}

export function tagged_codes(lesson: StoredLesson): string[] {
  return [...new Set(read_evidence(lesson).map((e) => e.code))];
}

export type Obligation = { code: string; parent: string | null };

/** Each listed focus code, replaced by its recorded focus leaves when the lesson narrowed it, plus added focus codes. */
export function focus_obligations(ctx: CheckContext): Obligation[] {
  const rec = recorded(ctx).filter((s) => s.role === "focus");
  const out: Obligation[] = [];
  for (const f of ctx.row.focus_codes) {
    const leaves = rec.filter((s) => s.code.startsWith(`${f}.`));
    if (leaves.length > 0) for (const l of leaves) out.push({ code: l.code, parent: f });
    else out.push({ code: f, parent: null });
  }
  for (const s of rec) {
    const under = ctx.row.focus_codes.some((f) => s.code === f || s.code.startsWith(`${f}.`));
    if (!under) out.push({ code: s.code, parent: null });
  }
  return out.filter((o, i) => out.findIndex((x) => x.code === o.code) === i);
}

/** ELD is decided by the official catalogue only: a forged "ELD."-looking string or an unloaded code is content. */
function is_eld(ctx: CheckContext, code: string): boolean {
  return ctx.standards.some((s) => s.code === code && s.set === "CA_ELD_6");
}

/** An assessment item covers its codes when it is really there and names at most MAX_CODES_PER_CHECK content standards. */
export function tag_covers(ctx: CheckContext, item: EvidenceItem): boolean {
  return (
    item.kind === "assess" &&
    item.substantiated &&
    item.tag_codes.filter((c) => !is_eld(ctx, c)).length <= MAX_CODES_PER_CHECK
  );
}

/** Codes covered by an assessment item of the given activities. */
export function assessment_codes(ctx: CheckContext, activities: readonly EvidenceActivity[]): Set<string> {
  return new Set(
    read_evidence(ctx.lesson)
      .filter((e) => activities.includes(e.activity) && tag_covers(ctx, e))
      .map((e) => e.code),
  );
}
