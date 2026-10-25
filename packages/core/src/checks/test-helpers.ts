import type { PMNode, StoredLesson } from "@ls/schema/lesson";
import { NormalizedRow } from "@ls/schema/outline";
import type {
  CheckContext,
  CheckFinding,
  CheckKind,
  GateIssue,
  GateState,
} from "./types.ts";
import { CHECK_POLICY } from "./policy.ts";
import { section_name_to_address } from "./rules/structural/expected.ts";

export const DEFAULT_POLICY = CHECK_POLICY;
export const LESSON_ID = "G6.U4.L4";

export const text = (t: string): PMNode => ({ type: "text", text: t });
export const p = (t: string): PMNode => ({
  type: "paragraph",
  content: [text(t)],
});
export const h = (level: number, t: string): PMNode => ({
  type: "heading",
  attrs: { level },
  content: [text(t)],
});
export const routine = (icon: string, t: string): PMNode => ({
  type: "routine_heading",
  attrs: { icon },
  content: [text(t)],
});
export const callout = (variant: string, t: string): PMNode => ({
  type: "callout",
  attrs: { variant },
  content: [p(t)],
});
export const eld_block = (omit: string[] = []): PMNode => ({
  type: "collapsible",
  attrs: { label: "Integrated ELD Instructions" },
  content: ["purpose", "say", "watch"]
    .filter((v) => !omit.includes(v))
    .map((v) => callout(v, `ELD ${v} note`)),
});
export const table = (header: boolean): PMNode => ({
  type: "table",
  content: [
    {
      type: "table_row",
      content: [
        {
          type: header ? "table_header" : "table_cell",
          content: [p("What occurred")],
        },
        { type: header ? "table_header" : "table_cell", content: [p("Tone")] },
      ],
    },
    {
      type: "table_row",
      content: [
        { type: "table_cell", content: [p("A event")] },
        { type: "table_cell", content: [p("calm")] },
      ],
    },
  ],
});

export function cfu_item(o: {
  code?: string;
  options?: number;
  correct?: number[];
  omit_rationale?: boolean;
}): PMNode[] {
  const n = o.options ?? 4;
  const correct = o.correct ?? [0];
  const rationales = Array.from({ length: n }, (_, i) =>
    p(`${correct.includes(i) ? "Correct" : "Incorrect"}: reason ${i + 1}`),
  );
  return [
    routine("cfu", `Pulse Check (${o.code ?? "RL.6.1"})`),
    p("Which statement is best supported?"),
    {
      type: "ordered_list",
      attrs: { order: 1, type: "A" },
      content: Array.from({ length: n }, (_, i) => ({
        type: "list_item",
        content: [p(`Option ${i + 1}`)],
      })),
    },
    ...(o.omit_rationale === true ? rationales.slice(1) : rationales),
  ];
}

export function section(
  name: string,
  lesson_id: string,
  minutes: number,
  nodes: PMNode[],
): StoredLesson["sections"][number] {
  return {
    address: section_name_to_address(lesson_id, name),
    name,
    minutes,
    content: { type: "doc", content: nodes },
  };
}

export function reading_lesson(
  overrides: Partial<StoredLesson> = {},
  minutes: Partial<Record<string, number>> = {},
): StoredLesson {
  const id = LESSON_ID;
  const m = (name: string, d: number): number => minutes[name] ?? d;
  return {
    lesson_id: id,
    schema_version: 1,
    title: "Reading lesson",
    type: "Reading",
    front_matter: { standards: [], minutes_total: 50, vocabulary: [] },
    sections: [
      section("Launch", id, m("Launch", 5), [
        routine("notes_section", "Notes"),
        p("Warm up."),
      ]),
      section("Literacy Lab", id, m("Literacy Lab", 10), [
        p("Lab."),
        eld_block(),
      ]),
      section("Learning in Action", id, m("Learning in Action", 30), [
        eld_block(),
        ...cfu_item({}),
      ]),
      section("Look Back", id, m("Look Back", 5), [
        routine("writing", "Quick Write"),
        p("Write."),
      ]),
      section("Homework", id, m("Homework", 0), [p("None.")]),
    ],
    text_cards: [],
    ...overrides,
  };
}

export function make_row(
  vocabulary: string[] = [],
  lesson_id: string = LESSON_ID,
): NormalizedRow {
  return NormalizedRow.parse({
    row_number: 1,
    kind: "lesson",
    lesson_id,
    number: 4,
    title: "T",
    lesson_type: "Reading",
    arc: null,
    segments: [],
    focus_codes: [],
    eld_codes: [],
    msls_codes: [],
    vocabulary,
    homework: null,
    pages: null,
    text_set: null,
  });
}

export function make_ctx(
  lesson: StoredLesson,
  vocabulary: string[] = [],
): CheckContext {
  return {
    lesson_id: lesson.lesson_id,
    content_hash: "0".repeat(64),
    outline_version_id: "G6.U4.ov1",
    lesson,
    row: make_row(vocabulary, lesson.lesson_id),
    arc_header: null,
    allowed_codes: [],
    standards: [],
    text_cards: [],
    links: [],
    linked_lessons: [],
    pending_suggestions: [],
    safety_flags: [],
    confirmations: [],
    previous_lesson_flags: [],
    unit_coverage: [],
  };
}

export function finding(
  kind: CheckKind,
  o: Partial<CheckFinding> = {},
): CheckFinding {
  return {
    kind,
    level: "blocking",
    message: "m",
    address: null,
    span_anchor: null,
    related_lesson_id: null,
    code: null,
    ...o,
  };
}

export function issue(kind: CheckKind, o: Partial<GateIssue> = {}): GateIssue {
  return {
    kind,
    level: "blocking",
    message: "m",
    address: null,
    code: null,
    related_lesson_id: null,
    resolved: false,
    ...o,
  };
}

export function gate_state(o: Partial<GateState> = {}): GateState {
  return {
    action: "submit",
    issues: [],
    pending_check: false,
    pending_suggestions: 0,
    open_confirmations: 0,
    last_editor_id: null,
    approver_id: null,
    four_eyes_enabled: false,
    dependencies: [],
    ...o,
  };
}
