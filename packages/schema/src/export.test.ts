// NL-09 AC-8 [invariant|negative]
import { describe, expect, it } from "vitest";
import { content_hash } from "./content-hash.ts";
import { ExportBundleFile } from "./export.ts";
import type { StoredLesson } from "./lesson.ts";

const U = "01ARZ3NDEKTSV4RRFFQ69G5FAV";
export const lesson = (id: string): StoredLesson => ({
  lesson_id: id, schema_version: 1, title: "T", type: "Reading",
  front_matter: { standards: [], minutes_total: 50, vocabulary: [] },
  sections: [{ address: "launch", name: "Launch", minutes: 5, content: { type: "doc" } }], text_cards: [],
});
const rec = (id: string) => ({
  lesson_id: id, version_id: `lv_${U}`, content_hash: content_hash(lesson(id)),
  approved_by: "reviewer", approved_at: "2026-10-25T12:00:00Z", lesson: lesson(id),
});
const bundle = () => ({ export_version: 1, unit_id: "G6.U4", generated_at: "2026-10-25T12:00:00Z", lessons: [rec("G6.U4.L1"), rec("G6.U4.L2")] });

describe("ExportBundleFile", () => {
  it("accepts a two-lesson bundle", () => expect(ExportBundleFile.safeParse(bundle()).success).toBe(true));
  it("rejects a lesson without content_hash", () => {
    const b = bundle();
    delete (b.lessons[0] as Record<string, unknown>).content_hash;
    expect(ExportBundleFile.safeParse(b).success).toBe(false);
  });
  it("rejects export_version 2", () => expect(ExportBundleFile.safeParse({ ...bundle(), export_version: 2 }).success).toBe(false));
});
