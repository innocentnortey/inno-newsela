// synthetic, WP-1 Lesson 5, traceable to docs/data/worked-pairs.md and the OpenAPI examples.
import type { components } from "../../src/lib/api-types";

type Lesson = components["schemas"]["Lesson"];
type IssueList = components["schemas"]["IssueList"];

export const HASH_A = "9f3c" + "0".repeat(56) + "a21e";
export const HASH_B = "7b1d" + "0".repeat(56) + "c0de";
export const SV_A = "AQLE9qQEBwA=";
export const SV_B = "AQLE9qQECAA=";

const ADDR = "G6.U4.L5";
const SECTIONS: [string, string, number][] = [
  ["Launch", "Launch", 5],
  ["LiteracyLab", "Literacy Lab", 10],
  ["LearningInAction.PartA", "Learning in Action Part A", 15],
  ["LearningInAction.PartB", "Learning in Action Part B", 10],
  ["LookBack", "Look Back", 5],
  ["Homework", "Homework", 5],
];

function lessonBase(id: string, key: string, n: number): Lesson {
  return {
    lesson_id: id, lesson_key: key, unit_id: "G6.U4", number: n, title: `Lesson ${n}: Comparing Percy and Soongoora`,
    type: "Writing", state: "submitted", version_number: 2, version_id: "lv-5-2", content_hash: HASH_A, state_vector: SV_A, schema_version: 1,
    last_editor: "M. Okafor",
    snapshot: { version_id: "lv-5-2", content_hash: HASH_A, state_vector: SV_A },
    front_matter: {
      standards: ["W.6.2.a", "W.6.2.b", "W.6.2.f"].map((code) => ({
        code, role: "focus", origin: "outline", official_text: "Synthetic standard text.", asserted_by: "outline", confirmation: "confirmed",
      })),
    },
    sections: SECTIONS.map(([suffix, name, minutes]) => ({
      address: `${ADDR}.${suffix}`, name, minutes,
      content: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: `Synthetic ${name} text for the approval review.` }] }] as never },
    })),
    text_cards: [{ title: "Percy and Soongoora (excerpt)", author: "J. Rivera", edition_or_isbn: null, chapter: null, pages: null, kind: "excerpt", rights_status: "public-domain" }],
    outline_row: { row_number: 14, segments: [] },
    alignment_map: [],
    reviewer: "J. Rivera",
    send_back: null,
    checklist: [
      { key: "standards", label: "Standards taught and checked", status: "ok", evidence_refs: [`${ADDR}.LearningInAction.PartA`] },
      { key: "quotes_and_rights", label: "Quotes and rights", status: "ok", evidence_refs: [`${ADDR}.LiteracyLab`] },
      { key: "eld_support", label: "ELD support present", status: "ok", evidence_refs: [`${ADDR}.Launch`] },
      { key: "content_safety", label: "Content safety", status: "ok", evidence_refs: [] },
      { key: "ai_spans", label: "AI suggestions settled", status: "ok", evidence_refs: [] },
    ],
    dependencies: [{ direction: "depended_on_by", lesson_id: "G6.U4.L4", slot_id: "slot-L5-PartA-excerpt", status: "waiting_for_source_approval" }],
    allowed_actions: [],
  };
}

export const lesson5Submitted = (): Lesson => lessonBase("G6.U4.L5", "L5", 5);
export const lesson5Changed = (): Lesson => ({
  ...lesson5Submitted(), content_hash: HASH_B, state_vector: SV_B, version_number: 3, version_id: "lv-5-3",
  snapshot: { version_id: "lv-5-3", content_hash: HASH_B, state_vector: SV_B },
});
export const lesson5Approved = (): Lesson => ({ ...lesson5Submitted(), state: "approved" });
export const lesson4Submitted = (): Lesson => ({
  ...lessonBase("G6.U4.L4", "L4", 4), title: "Lesson 4: Planning a Comparison",
  dependencies: [{ direction: "waits_on", lesson_id: "G6.U4.L5", slot_id: "slot-L5-PartA-excerpt", status: "waiting_for_source_approval" }],
});
export const lesson4InReview = (): Lesson => ({ ...lesson4Submitted(), state: "in_review", reviewer: "M. Okafor", snapshot: null, dependencies: [] });

export const issuesNone = (lessonId: string): IssueList => ({
  lesson_id: lessonId, stored_hash: HASH_A, checked_hash: HASH_A, checked_at: "2026-10-25T09:00:00Z", pending: false,
  counts: { blocking: 0, confirmation: 0, advisory: 0 }, issues: [],
});
