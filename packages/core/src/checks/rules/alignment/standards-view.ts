import type { PMNode, StoredLesson } from "@ls/schema/lesson";
import type { CheckContext } from "../../types.ts";
import { ELD_LABEL } from "../../../compile/labels.ts";
import { MAX_CODES_PER_CHECK, parse_tag } from "../../../compile/standard-tags.ts";
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

export function cfu_tags(ctx: CheckContext): CfuTag[] {
  const out: CfuTag[] = [];
  for (const section of ctx.lesson.sections) {
    for (const item of find_cfu_items(section)) {
      const m = /^Pulse Check \((.+)\)$/.exec(node_text(item.heading).trim());
      for (const raw of (m?.[1] ?? "").split(",")) {
        const code = raw.trim();
        if (code !== "") out.push({ code, address: item.address });
      }
    }
  }
  return out;
}

/** A parent code is covered by a tag naming it, or a recorded leaf below it. */
export function covered(f: string, tags: CfuTag[], recorded_codes: Set<string>): boolean {
  return tags.some(
    (t) => t.code === f || (t.code.startsWith(`${f}.`) && recorded_codes.has(t.code)),
  );
}

/** Addresses (part or section) with at least one teaching paragraph, in the named sections. */
function teaching_text_addresses(lesson: StoredLesson, names: readonly string[], say_callouts = false): string[] {
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
      else if (node.type === "collapsible") {
        // A "Say:" callout is what the teacher says aloud, so it is teaching text; purpose and watch notes and the
        // support table are not.
        if (say_callouts && node.attrs?.label === ELD_LABEL) {
          for (const k of node.content ?? []) if (k.attrs?.variant !== "say") walk(k, (n) => excluded.add(n));
        } else walk(node, (n) => excluded.add(n));
      }
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

/** Addresses of teaching parts (Literacy Lab and Learning in Action); S3's observer imports this. */
export function teaching_parts(lesson: StoredLesson): string[] {
  return teaching_text_addresses(lesson, ["Literacy Lab", "Learning in Action"]);
}

/** Addresses with teaching text (paragraphs and Say callouts) in Launch, Literacy Lab or Learning in Action. */
export function teaching_addresses(lesson: StoredLesson): Set<string> {
  return new Set(teaching_text_addresses(lesson, ["Launch", "Literacy Lab", "Learning in Action"], true));
}

export type DocTag = {
  kind: "teach" | "assess";
  source: "pulse_check" | "quick_write" | "routine";
  code: string;
  address: string;
  codes_in_tag: number;
  /** Every code the same heading names (this one included). */
  tag_codes: readonly string[];
};

/** Per-code evidence written on headings by the compiler (compile/standard-tags.ts). */
export function doc_tags(lesson: StoredLesson): DocTag[] {
  const out: DocTag[] = [];
  for (const section of lesson.sections) {
    if (section.name === "Homework") continue;
    visit_with_parts(section, ({ node, address }) => {
      if (node.type !== "routine_heading") return;
      const t = node_text(node).trim();
      const loose = parse_tag(t, false);
      let kind: DocTag["kind"];
      let source: DocTag["source"];
      let parsed = loose;
      if (node.attrs?.icon === "cfu" && loose?.label === "Pulse Check") {
        kind = "assess";
        source = "pulse_check";
      } else if (loose?.label === "Quick Write") {
        kind = "assess";
        source = "quick_write";
      } else {
        parsed = parse_tag(t, true);
        kind = "teach";
        source = "routine";
      }
      if (parsed === null) return;
      for (const code of parsed.codes) {
        out.push({ kind, source, code, address, codes_in_tag: parsed.codes.length, tag_codes: parsed.codes });
      }
    });
  }
  return out;
}

export function tagged_codes(lesson: StoredLesson): string[] {
  return [...new Set(doc_tags(lesson).map((t) => t.code))];
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

function is_eld(ctx: CheckContext, code: string): boolean {
  return (
    code.startsWith("ELD.") ||
    ctx.row.eld_codes.includes(code) ||
    recorded(ctx).some((s) => s.code === code && s.role === "eld") ||
    ctx.standards.some((s) => s.code === code && s.set === "CA_ELD_6")
  );
}

/** An assessment tag covers its codes unless it names more than MAX_CODES_PER_CHECK content standards; ELD codes do not count. */
export function tag_covers(ctx: CheckContext, tag: DocTag): boolean {
  return tag.kind === "assess" && tag.tag_codes.filter((c) => !is_eld(ctx, c)).length <= MAX_CODES_PER_CHECK;
}

/** Codes an assessment tag covers; an item naming more than MAX_CODES_PER_CHECK content codes covers none. */
export function assessment_codes(ctx: CheckContext, sources: readonly DocTag["source"][]): Set<string> {
  return new Set(
    doc_tags(ctx.lesson)
      .filter((t) => sources.includes(t.source) && tag_covers(ctx, t))
      .map((t) => t.code),
  );
}
