import { readFileSync } from "node:fs";
import { SCHEMA_VERSION } from "@ls/editor-schema/schema";
import type { UnitId } from "@ls/schema/ids";
import { LessonDraft } from "@ls/schema/lesson-draft";
import { NormalizedRow } from "@ls/schema/outline";
import { describe, expect, it } from "vitest";
import { find_cfu_items, node_text } from "../checks/rules/structural/doc-walk.ts";
import { compile_draft } from "./compile-draft.ts";
import { parse_rationale_label, rationale_label } from "./labels.ts";
import { template_for } from "./templates.ts";

const fixture = (n: string): unknown =>
  JSON.parse(readFileSync(new URL(`../../tests/fixtures/${n}`, import.meta.url), "utf8"));

describe("rationale labels", () => {
  it("rationale_label_matches_compiler", () => {
    const draft = LessonDraft.parse(fixture("draft-wp1.json"));
    const row = NormalizedRow.parse(fixture("row-wp1.json"));
    const compiled = compile_draft(draft, {
      row, template: template_for(row.lesson_type)!, unit_id: "G6.U4" as UnitId, schema_version: SCHEMA_VERSION,
    });
    const cfu = draft.blocks.find((b) => b.cfu)!.cfu!;
    const expected = cfu.options.map((_, i) => rationale_label(i, i === cfu.key_index));
    let seen: string[] = [];
    for (const s of compiled.lesson.sections) {
      for (const item of find_cfu_items(s)) {
        seen = item.blocks
          .filter((b) => b.type === "paragraph")
          .map((b) => parse_rationale_label(node_text(b)))
          .filter((r) => r !== null)
          .map((r) => `${r.letter}. ${r.correct ? "Correct:" : "Incorrect:"}`);
      }
    }
    expect(seen).toEqual(expected);
  });
  it("parse_round_trip", () => {
    for (let i = 0; i < 6; i += 1) {
      for (const c of [true, false]) {
        expect(parse_rationale_label(`${rationale_label(i, c)} because x`)).toEqual({
          letter: String.fromCharCode(65 + i), correct: c, body: "because x",
        });
      }
    }
  });
  it("parse_rejects_non_labels", () => {
    expect(parse_rationale_label("Which statement")).toBeNull();
    expect(parse_rationale_label("Correctly said")).toBeNull();
    expect(parse_rationale_label("Incorrect")?.correct).toBe(false);
    expect(parse_rationale_label("Correct answer")?.correct).toBe(true);
  });
  it("parse_unlettered", () => {
    expect(parse_rationale_label("Correct: reason 1")).toEqual({ letter: null, correct: true, body: "reason 1" });
  });
});
