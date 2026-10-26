// Oracle for the node names: docs/source/04-lesson-structure-analysis.md node table (callout variants, collapsible labels)
// and the worked-pair node names. Literals are hand-written, not read from the table under test.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { SCHEMA_VERSION } from "@ls/editor-schema/schema";
import type { UnitId } from "@ls/schema/ids";
import type { PMNode } from "@ls/schema/lesson";
import { DRAFT_ROLES, LessonDraft } from "@ls/schema/lesson-draft";
import { build_ctx } from "../checks/rules/grounding/fixtures/build.ts";
import { compile_draft } from "./compile-draft.ts";
import { ROLE_NODE, parts_present, role_present } from "./role-nodes.ts";
import { template_for } from "./templates.ts";

const t = (text: string, marks?: string[]): PMNode => ({
  type: "text",
  text,
  ...(marks ? { marks: marks.map((type) => ({ type })) } : {}),
});
const para = (...c: PMNode[]): PMNode => ({ type: "paragraph", content: c });

describe("role nodes", () => {
  it("callout_variants_are_distinct", () => {
    const n: PMNode[] = [{ type: "callout", attrs: { variant: "say" }, content: [para(t("x"))] }];
    expect(role_present(n, "callout_say")).toBe(true);
    expect(role_present(n, "callout_purpose")).toBe(false);
  });

  it("support_table_is_not_the_eld_dropdown", () => {
    const c = (label: string): PMNode[] => [{ type: "collapsible", attrs: { label }, content: [] }];
    expect(role_present(c("Additional Student Support"), "support_table")).toBe(true);
    expect(role_present(c("Additional Student Support: Finding Evidence"), "support_table")).toBe(true);
    expect(role_present(c("Integrated ELD Instructions"), "support_table")).toBe(false);
  });

  it("marks_not_headings", () => {
    const marked: PMNode[] = [para(t("Say: hi", ["teacher_talk"]))];
    expect(role_present(marked, "teacher_talk")).toBe(true);
    expect(role_present(marked, "sample_response")).toBe(false);
    const plain: PMNode[] = [para(t("Say: hi"))];
    expect(role_present(plain, "teacher_talk")).toBe(false);
    expect(role_present(plain, "sample_response")).toBe(false);
  });

  it("routine_roles_by_icon", () => {
    const r = (icon: string): PMNode[] => [{ type: "routine_heading", attrs: { icon }, content: [t("R")] }];
    const roles = ["routine_heading", "cfu_item", "quick_write"] as const;
    const got = (icon: string) => roles.filter((x) => role_present(r(icon), x));
    expect(got("notes_section")).toEqual(["routine_heading"]);
    expect(got("cfu")).toEqual(["cfu_item"]);
    expect(got("writing")).toEqual(["routine_heading", "quick_write"]);
  });

  it("slots_tips_lists", () => {
    const pairs = [
      ["quote_placeholder", "text_evidence_needed"],
      ["excerpt_slot", "excerpt_slot"],
      ["teacher_tip", "teacher_tip"],
      ["bullet_list", "list"],
      ["paragraph", "paragraph"],
    ] as const;
    for (const [node, role] of pairs) expect(role_present([{ type: node }], role), role).toBe(true);
  });

  it("homework_is_any_non_empty_text", () => {
    expect(role_present([{ type: "paragraph" }], "homework")).toBe(false);
    expect(role_present([para(t("Read."))], "homework")).toBe(true);
  });

  it("parts_present_reads_level_two_headings", () => {
    const h = (level: number, text: string): PMNode => ({ type: "heading", attrs: { level }, content: [t(text)] });
    expect(parts_present([h(2, "Part A"), h(2, "Part B "), h(3, "Part C")])).toEqual(["Part A", "Part B"]);
  });

  it("every_draft_role_has_a_mapping", () => {
    expect(DRAFT_ROLES.every((r) => ROLE_NODE[r] !== undefined)).toBe(true);
  });

  it("compiled_roles_round_trip", () => {
    const strip = (o: unknown): unknown =>
      Object.fromEntries(Object.entries(o as Record<string, unknown>).filter(([k]) => !k.startsWith("_")));
    const cases = [
      { fixture: "wp1" as const, file: "../../../llm/src/fixtures/draft-wp1.json", type: "Reading" },
      { fixture: "wp2" as const, file: "../../../llm/src/fixtures/draft-wp2.json", type: "Writing" },
      { fixture: "wp3" as const, file: "../../../../evals/cases/drafts/_fixtures/good-wp-3.json", type: "Flex Day" },
    ];
    for (const c of cases) {
      const draft = LessonDraft.parse(strip(JSON.parse(readFileSync(new URL(c.file, import.meta.url), "utf8"))));
      const compiled = compile_draft(draft, {
        row: build_ctx(c.fixture).row,
        template: template_for(c.type)!,
        unit_id: "G6.U4" as UnitId,
        schema_version: SCHEMA_VERSION,
      });
      const seen = new Set(draft.blocks.map((b) => `${b.section}|${b.role}`));
      for (const key of seen) {
        const [section, role] = key.split("|") as [string, (typeof DRAFT_ROLES)[number]];
        const sec = compiled.lesson.sections.find((s) => s.name === section);
        expect(role_present(sec?.content.content ?? [], role), `${c.fixture} ${key}`).toBe(true);
      }
    }
  });
});
