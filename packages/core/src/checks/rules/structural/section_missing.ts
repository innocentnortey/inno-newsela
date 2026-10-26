import type { PMNode } from "@ls/schema/lesson";
import type { CheckFinding, CheckRule } from "../../types.ts";
import { EXPECTED_SECTIONS, section_name_to_address } from "./expected.ts";
import { section_nodes, walk } from "./doc-walk.ts";
import { excerpt_obligation } from "../links/slot-obligations.ts";
import { count_excerpt_slots } from "../links/slots.ts";

function has_role(nodes: PMNode[], role: string): boolean {
  let found = false;
  for (const top of nodes) {
    walk(top, (n) => {
      if (role === "cfu") {
        if (n.type === "routine_heading" && n.attrs?.icon === "cfu")
          found = true;
      } else if (role.startsWith("eld_callout_")) {
        if (
          n.type === "callout" &&
          n.attrs?.variant === role.slice("eld_callout_".length)
        ) {
          found = true;
        }
      }
    });
  }
  return found;
}

export const section_missing_rule: CheckRule = {
  kind: "section_missing",
  level: "blocking",
  run: (ctx) => {
    const tmpl = EXPECTED_SECTIONS(ctx.lesson.type);
    if (tmpl === null) return [];
    const out: CheckFinding[] = [];
    const finding = (message: string, address: string): CheckFinding => ({
      kind: "section_missing",
      level: "blocking",
      message,
      address,
      span_anchor: null,
      related_lesson_id: null,
      code: null,
    });
    for (const expected of tmpl) {
      const stored = ctx.lesson.sections.find((s) => s.name === expected.name);
      if (stored === undefined) {
        out.push(
          finding(
            `Section "${expected.name}" is missing`,
            section_name_to_address(ctx.lesson.lesson_id, expected.name),
          ),
        );
        continue;
      }
      const nodes = section_nodes(stored);
      for (const role of expected.required_roles) {
        if (!has_role(nodes, role)) {
          out.push(
            finding(
              `Section "${expected.name}" is missing required role ${role}`,
              stored.address,
            ),
          );
        }
      }
    }
    // A required excerpt slot that was never created is blocking; an open slot is a different rule's work.
    const ob = excerpt_obligation(ctx);
    if (ob.needed && count_excerpt_slots(ctx.lesson.sections) === 0) {
      const where =
        ctx.lesson.sections.find((s) => s.name === "Learning in Action")?.address ??
        ctx.lesson.sections[0]?.address ??
        ctx.lesson.lesson_id;
      out.push(finding(`Lesson is missing a required excerpt slot (${ob.reasons.join("; ")})`, where));
    }
    return out;
  },
};
