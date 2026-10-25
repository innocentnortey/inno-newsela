import type { CheckFinding, CheckRule } from "../../types.ts";
import { EXPECTED_SECTIONS } from "./expected.ts";
import { find_cfu_items, node_text, visit_with_parts } from "./doc-walk.ts";

const RATIONALE_RE = /^\s*(Correct|Incorrect)\b/;

export const schema_invalid_rule: CheckRule = {
  kind: "schema_invalid",
  level: "blocking",
  run: (ctx) => {
    const out: CheckFinding[] = [];
    const finding = (message: string, address: string): CheckFinding => ({
      kind: "schema_invalid",
      level: "blocking",
      message,
      address,
      span_anchor: null,
      related_lesson_id: null,
      code: null,
    });
    if (EXPECTED_SECTIONS(ctx.lesson.type) === null) {
      out.push(
        finding(
          `Unknown lesson type "${ctx.lesson.type}"`,
          ctx.lesson.lesson_id,
        ),
      );
    }
    for (const section of ctx.lesson.sections) {
      let prev_level = 0;
      visit_with_parts(section, ({ node, address }) => {
        if (node.type === "heading") {
          const level =
            typeof node.attrs?.level === "number" ? node.attrs.level : 0;
          if (prev_level > 0 && level > prev_level + 1) {
            out.push(
              finding(
                `Heading level jumps from h${prev_level} to h${level}`,
                address,
              ),
            );
          }
          prev_level = level;
        } else if (node.type === "table") {
          const first = (node.content ?? []).find(
            (r) => r.type === "table_row",
          );
          const cells = first?.content ?? [];
          if (
            cells.length === 0 ||
            !cells.every((c) => c.type === "table_header")
          ) {
            out.push(finding("Table has no header row", address));
          }
        }
      });
      for (const item of find_cfu_items(section)) {
        const list = item.blocks.find(
          (b) => b.type === "ordered_list" && b.attrs?.type === "A",
        );
        if (list === undefined) {
          out.push(finding("CFU item has no lettered options", item.address));
          continue;
        }
        const n = (list.content ?? []).filter(
          (c) => c.type === "list_item",
        ).length;
        const rationales = item.blocks
          .filter((b) => b.type === "paragraph")
          .map((b) => RATIONALE_RE.exec(node_text(b)))
          .filter((m): m is RegExpExecArray => m !== null);
        const correct = rationales.filter((m) => m[1] === "Correct").length;
        if (correct !== 1) {
          out.push(
            finding(
              `CFU item must have exactly one Correct option (found ${correct})`,
              item.address,
            ),
          );
        }
        if (rationales.length !== n) {
          out.push(
            finding(
              "CFU item is missing a rationale for each option",
              item.address,
            ),
          );
        }
      }
    }
    return out;
  },
};
