import type { PMNode, StoredLesson } from "@ls/schema/lesson";
import type { CheckContext } from "../../types.ts";
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

/**
 * Addresses of teaching parts. Compiled lessons carry no per-code teach tag, so
 * "taught" means the lesson has at least one teaching part; this is the one seam
 * to replace if a per-code tag lands.
 */
export function teaching_parts(lesson: StoredLesson): string[] {
  const found: string[] = [];
  for (const section of lesson.sections) {
    if (section.name !== "Literacy Lab" && section.name !== "Learning in Action") continue;
    const excluded = new Set<PMNode>();
    for (const item of find_cfu_items(section)) {
      excluded.add(item.heading);
      for (const b of item.blocks) walk(b, (n) => excluded.add(n));
    }
    visit_with_parts(section, ({ node }) => {
      if (node.type === "teacher_tip" || node.type === "collapsible") {
        walk(node, (n) => excluded.add(n));
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
