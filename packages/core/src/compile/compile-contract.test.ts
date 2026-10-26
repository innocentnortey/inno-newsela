// The worked-pair component contract: every required role in evals/cases/drafts/<wp>/expected.json (read only)
// must exist in the compiled section, and in its Part A / Part B region when the pair names one.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { SCHEMA_VERSION } from "@ls/editor-schema/schema";
import type { UnitId } from "@ls/schema/ids";
import type { PMNode } from "@ls/schema/lesson";
import { LessonDraft } from "@ls/schema/lesson-draft";
import { build_ctx } from "../checks/rules/grounding/fixtures/build.ts";
import { compile_draft } from "./compile-draft.ts";
import { template_for } from "./templates.ts";

type Expected = {
  sections: { name: string; required_roles: { part: string | null; roles: string[] }[] }[];
  placeholders: { exact: number };
};
const here = (rel: string): URL => new URL(rel, import.meta.url);
const json = (rel: string): unknown => JSON.parse(readFileSync(here(rel), "utf8"));
const strip = (o: unknown): unknown =>
  Object.fromEntries(Object.entries(o as Record<string, unknown>).filter(([k]) => !k.startsWith("_")));

const CASES = [
  { wp: "wp-1", fixture: "wp1" as const, draft: "../../../llm/src/fixtures/draft-wp1.json", type: "Reading" },
  { wp: "wp-2", fixture: "wp2" as const, draft: "../../../llm/src/fixtures/draft-wp2.json", type: "Writing" },
  { wp: "wp-3", fixture: "wp3" as const, draft: "../../../../evals/cases/drafts/_fixtures/good-wp-3.json", type: "Flex Day" },
];

const text_of = (n: PMNode): string => (n.type === "text" ? n.text ?? "" : (n.content ?? []).map(text_of).join(""));
const all = (n: PMNode): PMNode[] => [n, ...(n.content ?? []).flatMap(all)];
const has_mark = (n: PMNode, mark: string): boolean => (n.marks ?? []).some((m) => m.type === mark);

function present(nodes: PMNode[], role: string): boolean {
  const flat = nodes.flatMap(all);
  const routine = (icon?: string) =>
    flat.some((n) => n.type === "routine_heading" && (icon === undefined ? n.attrs?.icon !== "cfu" : n.attrs?.icon === icon));
  switch (role) {
    case "routine_heading": return routine();
    case "teacher_talk": return flat.some((n) => n.type === "text" && has_mark(n, "teacher_talk"));
    case "sample_response": return flat.some((n) => n.type === "text" && has_mark(n, "sample_response"));
    case "support_table": return flat.some((n) => n.type === "collapsible" && n.attrs?.label === "Additional Student Support");
    case "cfu_item": return routine("cfu");
    case "quick_write": return routine("writing");
    case "text_evidence_needed": return flat.some((n) => n.type === "quote_placeholder");
    case "excerpt_slot": return flat.some((n) => n.type === "excerpt_slot");
    case "teacher_tip": return flat.some((n) => n.type === "teacher_tip");
    case "homework": return flat.some((n) => n.type === "paragraph");
    default: throw new Error(`no node mapping for ${role}`);
  }
}

/** Nodes of a section, or of one Part region of it. */
function region(content: PMNode[], part: string | null): PMNode[] {
  if (part === null) return content;
  const out: PMNode[] = [];
  let inside = false;
  for (const n of content) {
    if (n.type === "heading" && n.attrs?.level === 2) inside = text_of(n).trim() === part;
    else if (inside) out.push(n);
  }
  return out;
}

describe("compile contract against the worked pairs", () => {
  for (const c of CASES) {
    it(`${c.wp.replace("-", "")}_components`, () => {
      const expected = json(`../../../../evals/cases/drafts/${c.wp}/expected.json`) as Expected;
      const draft = LessonDraft.parse(strip(json(c.draft)));
      const row = build_ctx(c.fixture).row;
      const compiled = compile_draft(draft, {
        row, template: template_for(c.type)!, unit_id: "G6.U4" as UnitId, schema_version: SCHEMA_VERSION,
      });
      for (const s of expected.sections) {
        const sec = compiled.lesson.sections.find((x) => x.name === s.name);
        for (const req of s.required_roles) {
          for (const role of req.roles) {
            const nodes = region(sec?.content.content ?? [], req.part);
            expect(present(nodes, role), `${c.wp} ${s.name} ${req.part ?? ""} ${role}`).toBe(true);
          }
        }
      }
      expect(compiled.placeholders).toBe(expected.placeholders.exact);
      if (c.wp !== "wp-3") {
        const lia = compiled.lesson.sections.find((x) => x.name === "Learning in Action")!;
        expect(lia.content.content?.filter((n) => n.type === "heading").map(text_of)).toEqual(["Part A", "Part B"]);
      }
      expect(compiled.part_remaps).toEqual([]);
    });
  }
});
