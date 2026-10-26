import type { CheckFinding, CheckRule } from "../../types.ts";
import { section_address } from "../../../compile/addresses.ts";
import { parts_present, role_present } from "../../../compile/role-nodes.ts";
import { template_for } from "../../../compile/templates.ts";
import { section_nodes } from "./doc-walk.ts";
import { excerpt_obligation, obligation_address } from "../links/slot-obligations.ts";
import { count_excerpt_slots } from "../links/slots.ts";

export const section_missing_rule: CheckRule = {
  kind: "section_missing",
  level: "blocking",
  run: (ctx) => {
    const template = template_for(ctx.lesson.type);
    if (template === undefined) return [];
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
    for (const slot of template.sections) {
      const stored = ctx.lesson.sections.find((s) => s.name === slot.name);
      if (stored === undefined) {
        // The address the compiler assigns, so a recorded resolution and the editor agree.
        out.push(finding(`Section "${slot.name}" is missing`, section_address(ctx.lesson.lesson_id, slot.name)));
        continue;
      }
      const nodes = section_nodes(stored);
      for (const role of slot.required_roles) {
        if (!role_present(nodes, role)) {
          out.push(finding(`Section "${slot.name}" is missing required role ${role}`, stored.address));
        }
      }
      const parts = parts_present(nodes);
      for (const label of slot.parts ?? []) {
        if (!parts.includes(label)) {
          out.push(finding(`Section "${slot.name}" is missing part "${label}"`, stored.address));
        }
      }
    }
    // A required excerpt slot that was never created is blocking; an open slot is a different rule's work.
    const ob = excerpt_obligation(ctx);
    if (ob.needed && count_excerpt_slots(ctx.lesson.sections) === 0) {
      const where = obligation_address(ctx);
      out.push(finding(`Lesson is missing a required excerpt slot (${ob.reasons.join("; ")})`, where));
    }
    return out;
  },
};
