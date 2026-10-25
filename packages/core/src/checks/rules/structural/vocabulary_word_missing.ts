import type { PMNode } from "@ls/schema/lesson";
import type { CheckFinding, CheckRule } from "../../types.ts";
import { node_text, visit_with_parts } from "./doc-walk.ts";

const norm = (s: string): string => s.toLowerCase().trim().replace(/\s+/g, " ");

function matches(entry: string, word: string): boolean {
  const e = norm(entry);
  const w = norm(word);
  if (e === w) return true;
  return e.startsWith(w) && !/\p{L}/u.test(e.charAt(w.length));
}

export const vocabulary_word_missing_rule: CheckRule = {
  kind: "vocabulary_word_missing",
  level: "blocking",
  run: (ctx) => {
    const list_b: string[] = [];
    for (const section of ctx.lesson.sections) {
      visit_with_parts(section, ({ node, siblings, index }) => {
        if (
          node.type !== "routine_heading" ||
          node.attrs?.icon !== "personal_dictionary"
        )
          return;
        for (let i = index + 1; i < siblings.length; i += 1) {
          const s: PMNode | undefined = siblings[i];
          if (
            s === undefined ||
            s.type === "routine_heading" ||
            s.type === "heading"
          )
            break;
          if (s.type === "bullet_list" || s.type === "ordered_list") {
            for (const li of s.content ?? []) list_b.push(node_text(li));
          } else if (s.type === "paragraph") {
            list_b.push(...node_text(s).split(/[,;]/));
          }
        }
      });
    }
    const out: CheckFinding[] = [];
    for (const word of ctx.row.vocabulary) {
      const found =
        ctx.lesson.front_matter.vocabulary.some((v) => matches(v, word)) ||
        list_b.some((v) => matches(v, word));
      if (!found) {
        out.push({
          kind: "vocabulary_word_missing",
          level: "blocking",
          message: `Vocabulary word "${word}" appears in neither vocabulary list`,
          address: `${ctx.lesson.lesson_id}.FrontMatter`,
          span_anchor: null,
          related_lesson_id: null,
          code: null,
        });
      }
    }
    return out;
  },
};
