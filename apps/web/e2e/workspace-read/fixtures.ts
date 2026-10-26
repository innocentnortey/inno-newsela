import type { components } from "../../src/lib/api-types";

type Lesson = components["schemas"]["Lesson"];
type IssueList = components["schemas"]["IssueList"];
type Doc = Lesson["sections"][number]["content"];

// Synthetic. Mirrors the OpenAPI lesson4 / lesson4v1 examples with real section content.
const t = (text: string, marks?: { type: string }[]) => ({ type: "text", text, ...(marks ? { marks } : {}) });
const p = (...content: object[]) => ({ type: "paragraph", content });
const doc = (...content: object[]) => ({ type: "doc", content }) as unknown as Doc;

export const LESSON4: Lesson = {
  lesson_id: "G6.U4.L4",
  lesson_key: "L4",
  unit_id: "G6.U4",
  number: 4,
  title: "Lesson 4: The Lightning Thief, Chapter 1",
  type: "Reading",
  state: "in_review",
  version_number: 1,
  version_id: "lv-5-1",
  content_hash: "9f00000000000000000000000000000000000000000000000000000000000405",
  state_vector: "AQKH6qQEAA==",
  schema_version: 1,
  last_editor: "Reviewer A (demo)",
  snapshot: null,
  front_matter: {
    standards: [
      { code: "RL.6.1", role: "focus", origin: "outline", official_text: "Cite textual evidence to support analysis of what the text says explicitly as well as inferences drawn from the text.", asserted_by: "outline", confirmation: null },
      { code: "L.6.4.b", role: "focus", origin: "narrowed", official_text: "Use common, grade-appropriate Greek or Latin affixes and roots as clues to the meaning of a word.", asserted_by: "generator", confirmation: "open" },
    ],
  },
  sections: [
    { address: "G6.U4.L4.Launch", name: "Launch", minutes: 5, content: doc(p(t("Say: ", [{ type: "teacher_talk" }]), t("Today we read the first chapter."))) },
    {
      address: "G6.U4.L4.LiteracyLab",
      name: "Literacy Lab",
      minutes: 10,
      content: doc(
        { type: "routine_heading", attrs: { icon: "cfu" }, content: [t("Check for understanding")] },
        p(t("Sample answer: ", [{ type: "strong" }]), t("Percy sounds sarcastic.", [{ type: "sample_response" }])),
      ),
    },
    {
      address: "G6.U4.L4.LearningInAction.PartA",
      name: "Learning in Action Part A",
      minutes: 15,
      content: doc(
        p(t("Read pages 1 to 8 together.")),
        { type: "quote_placeholder", attrs: { slot_id: "slot-L4-PartA-quote", reason: "Reviewer to insert: one sentence from Ch. 1, pp. 1–8, where Percy's sarcastic word choice sets the tone" } },
      ),
    },
    { address: "G6.U4.L4.LearningInAction.PartB", name: "Learning in Action Part B", minutes: 15, content: doc(p(t("Discuss with a partner."))) },
    { address: "G6.U4.L4.LookBack", name: "Look Back", minutes: 5, content: doc(p(t("Write one sentence."))) },
    { address: "G6.U4.L4.Homework", name: "Homework", minutes: 0, content: doc(p(t("Choose a text for tomorrow."))) },
  ],
  text_cards: [
    { title: "The Lightning Thief", author: "Rick Riordan", edition_or_isbn: "9780786838653", chapter: "1", pages: "1–8", kind: "off-platform-text", rights_status: null },
  ],
  outline_row: {
    row_number: 8,
    segments: [
      { segment_id: "s-8-N-2", column: "N", kind: "editor_note", text: "Instead, think about using morphology when teaching the vocabulary words", action: "apply", source: "default", by: null },
    ],
  },
  alignment_map: [
    { code: "RL.6.1", teach_links: ["G6.U4.L4.LearningInAction.PartA"], check_links: ["G6.U4.L4.LookBack"], link_role: "P", asserted_by: "outline" },
  ],
  reviewer: "Reviewer A (demo)",
  send_back: null,
  checklist: [],
  dependencies: [{ direction: "waits_on", lesson_id: "G6.U4.L5", slot_id: "slot-L5-PartA-excerpt", status: "slot_empty" }],
  allowed_actions: ["submit", "regenerate", "request_suggestion"],
};

export const ISSUES4: IssueList = {
  lesson_id: "G6.U4.L4",
  stored_hash: "9f00000000000000000000000000000000000000000000000000000000000405",
  checked_hash: "9f00000000000000000000000000000000000000000000000000000000000405",
  checked_at: "2026-10-25T15:40:03Z",
  pending: false,
  counts: { blocking: 2, confirmation: 1, advisory: 1 },
  issues: [
    { issue_id: "iss-4-1", level: "blocking", blocks: ["submit", "approve"], resolvable: true, kind: "quote_placeholder_open", message: "Reviewer to insert: one sentence from Ch. 1, pp. 1–8, where Percy's sarcastic word choice sets the tone", address: "G6.U4.L4.LearningInAction.PartA", span_anchor: "AQ==", related_lesson_id: null, resolution: null },
    { issue_id: "iss-4-2", level: "blocking", blocks: ["submit", "approve"], resolvable: false, kind: "cross_lesson_link", message: "Homework text not chosen", address: "G6.U4.L4.Homework", span_anchor: null, related_lesson_id: "G6.U4.L5", resolution: null },
    { issue_id: "iss-4-3", level: "confirmation", blocks: ["submit", "approve"], resolvable: false, kind: "standard_confirmation", message: "L.6.4.b is AI-proposed: confirm or remove", address: null, span_anchor: null, related_lesson_id: null, resolution: null },
    { issue_id: "iss-4-4", level: "advisory", blocks: [], resolvable: false, kind: "eld_label_mismatch", message: "ELD.PII.6.5 label belongs to another strand", address: null, span_anchor: null, related_lesson_id: null, resolution: null },
  ],
};

export function lessonWith(state: Lesson["state"], patch: Partial<Lesson> = {}): Lesson {
  return { ...LESSON4, state, ...patch };
}
