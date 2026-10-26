// F2-D1: standards evidence lives in heading text (a codec), so edit -> save (Yjs) -> export (JSON + schema) must not
// change what read_evidence sees. No persistence field exists to migrate.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { SCHEMA_VERSION } from "@ls/editor-schema/schema";
import type { UnitId } from "@ls/schema/ids";
import { LessonDraft } from "@ls/schema/lesson-draft";
import { StoredLesson } from "@ls/schema/lesson";
import type { PMNode } from "@ls/schema/lesson";
import { NormalizedRow } from "@ls/schema/outline";
import { compile_draft } from "@ls/core/compile/compile-draft";
import { standards_for_lesson } from "@ls/core/compile/standard-identity";
import { template_for } from "@ls/core/compile/templates";
import { read_evidence } from "@ls/core/checks/rules/alignment/evidence";
import { lesson_to_ydoc, ydoc_to_lesson } from "./convert.ts";

const fixture = (n: string): unknown => JSON.parse(readFileSync(new URL(`../../core/tests/fixtures/${n}.json`, import.meta.url), "utf8"));

function compiled_wp1(): StoredLesson {
  const row = NormalizedRow.parse(fixture("row-wp1"));
  const c = compile_draft(LessonDraft.parse(fixture("draft-wp1")), {
    row, template: template_for(row.lesson_type)!, unit_id: "G6.U4" as UnitId, schema_version: SCHEMA_VERSION,
  });
  const catalogue = row.focus_codes.map((code) => ({
    code, set: "CA_CCSS_ELA_6" as const, text: `synthetic ${code}`, parent_code: null, is_leaf: true, eld_strand: null,
  }));
  return { ...c.lesson, front_matter: { ...c.lesson.front_matter, standards: standards_for_lesson(row, catalogue, []) } };
}

/** The reviewer edit: retitle the first plain routine heading and tag it RL.6.1. */
function retitle(lesson: StoredLesson, title: string): StoredLesson {
  const copy = structuredClone(lesson);
  let done = false;
  const go = (n: PMNode): void => {
    if (done) return;
    const t = n.content?.[0]?.text;
    if (n.type === "routine_heading" && n.attrs?.icon !== "cfu" && t !== undefined) {
      n.content![0]!.text = `${title} (RL.6.1)`;
      done = true;
      return;
    }
    for (const k of n.content ?? []) go(k);
  };
  for (const s of copy.sections) go(s.content as PMNode);
  if (!done) throw new Error("fixture has no routine heading to retitle");
  return copy;
}

describe("evidence round trip", () => {
  it("compiled_wp1_evidence_survives_the_yjs_round_trip", () => {
    const lesson = compiled_wp1();
    const before = read_evidence(lesson);
    expect(before.length).toBeGreaterThan(0);
    expect(read_evidence(ydoc_to_lesson(lesson_to_ydoc(lesson), lesson.schema_version))).toEqual(before);
  });

  it("edited_heading_text_round_trips_with_the_tag", () => {
    const edited = retitle(compiled_wp1(), "A new title for the same routine");
    const back = ydoc_to_lesson(lesson_to_ydoc(edited), edited.schema_version);
    expect(read_evidence(back)).toEqual(read_evidence(edited));
    expect(read_evidence(back).some((e) => e.code === "RL.6.1" && e.kind === "teach")).toBe(true);
  });

  it("export_bundle_keeps_the_evidence", () => {
    const lesson = compiled_wp1();
    const exported = StoredLesson.parse(JSON.parse(JSON.stringify(lesson)));
    expect(read_evidence(exported)).toEqual(read_evidence(lesson));
  });
});
