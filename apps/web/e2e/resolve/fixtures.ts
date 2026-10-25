import type { components } from "../../src/lib/api-types";
import { ISSUES4, LESSON4 } from "../workspace-read/fixtures";

type Lesson = components["schemas"]["Lesson"];
type IssueList = components["schemas"]["IssueList"];

// Synthetic. Derived from WP-4 (Lesson 31, content warning on outline row 39).
export const LESSON31: Lesson = {
  ...LESSON4,
  lesson_id: "G6.U4.L31",
  lesson_key: "L31",
  number: 31,
  title: "Lesson 31: The Lightning Thief, Chapter 21",
  type: "Writing",
  outline_row: {
    row_number: 39,
    segments: [
      {
        segment_id: "s-39-I-2",
        column: "I",
        kind: "safety_note",
        text: "Warn students about potentially triggering scene in tonight's reading (references to domestic abuse)",
        action: null,
        source: "default",
        by: null,
      },
    ],
  },
} as Lesson;

const base = ISSUES4.issues[0]!;
export const ISSUES31: IssueList = {
  ...ISSUES4,
  lesson_id: "G6.U4.L31",
  counts: { blocking: 2, confirmation: 0, advisory: 0 },
  issues: [
    { ...base, issue_id: "iss-31-1", kind: "safety_flag_open", level: "blocking", resolvable: false, message: "Safety flag open · content warning from the outline (row 39, Homework)", resolution: null },
    { ...base, issue_id: "iss-31-2", kind: "quote_placeholder_open", level: "blocking", resolvable: true, message: "Quote placeholder open in Learning in Action Part A", resolution: null },
  ],
};

export const RESULT = (status: "resolved" | "cleared", itemId: string) => ({
  item_id: itemId,
  status,
  by: "J. Rivera",
  at: "2026-10-25T16:00:00Z",
  audit_id: "aud-3101",
  counts: { blocking: 1, confirmation: 0, advisory: 0 },
});
