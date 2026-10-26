// Synthetic in-memory fakes for the NL-44 tests. WP-1 L4 per docs/data/worked-pairs.md (row 8, G6.U4.L4). Every write throws.
import Decimal from "decimal.js";
import type { AlignmentLinkRow } from "@ls/core/ports/alignment";
import type { HistoryRow } from "@ls/core/ports/audit";
import type { IssueRow } from "@ls/core/ports/issues";
import type { DependencyState } from "@ls/core/ports/lesson-graph";
import type { LessonRow } from "@ls/core/ports/lesson-state";
import type { LessonVersionRow, ProvenanceRecord } from "@ls/core/ports/lesson-versions";
import type { SafetyFlagRow } from "@ls/core/ports/safety-flags";
import type { RequestUser } from "@ls/core/ports/common";
import type { StoredLesson } from "@ls/schema/lesson";
import { LessonReadService } from "./lesson-read-service.ts";

export const LID = "G6.U4.L4";
export const OV = "G6.U4.ov1";
export const H1 = "a".repeat(64);
export const H2 = "b".repeat(64);
export const SV = "c".repeat(64);
export const crock = (p: string, c: string) => `${p}_${c.repeat(26)}`;
export const V_GEN = crock("lv", "1");
export const V_CAND = crock("lv", "2");
export const V_SUB = crock("lv", "3");
export const U_REV = crock("usr", "4");
export const OFFICIAL = "Determine the meaning of words and phrases (synthetic).";
export const XSS = "<img src=x onerror=alert(1)>";

const doc = (text: string) => ({
  type: "doc" as const,
  content: [{ type: "paragraph", content: [{ type: "text", text }] }],
});

export function make_lesson(over: Partial<StoredLesson> = {}): StoredLesson {
  const names = ["Launch", "Literacy Lab", "Learning in Action Part A", "Learning in Action Part B", "Look Back"];
  const addrs = [
    "G6.U4.L4.Launch",
    "G6.U4.L4.LiteracyLab",
    "G6.U4.L4.LearningInAction.PartA",
    "G6.U4.L4.LearningInAction.PartB",
    "G6.U4.L4.LookBack",
  ];
  return {
    lesson_id: LID,
    schema_version: 1,
    title: "Reading closely",
    type: "Reading",
    front_matter: {
      standards: [
        { code: "RL.6.1", role: "focus", origin: "outline", official_text: "Cite textual evidence (synthetic).", asserted_by: "outline", confirmation: null },
        { code: "L.6.4.b", role: "supporting", origin: "narrowed", official_text: OFFICIAL, asserted_by: "generator", confirmation: "open" },
      ],
      minutes_total: 50,
      vocabulary: ["inference"],
    },
    sections: names.map((name, i) => ({ address: addrs[i] as string, name, minutes: 10, content: doc(`${name} body`) })),
    text_cards: [],
    ...over,
  };
}

export const prov = (over: Partial<ProvenanceRecord> = {}): ProvenanceRecord => ({
  outline_row_hash: H1,
  prompt_version_id: "pr_gen",
  model: "model-x",
  parameters: { temperature: 0.2 },
  schema_version: 1,
  example_set_id: "ex-1",
  run_id: crock("run", "5"),
  model_call_ids: [],
  cost_usd: new Decimal("0.42"),
  ai_assisted_spans: 0,
  derived_from_version_id: null,
  ...over,
});

export function version_row(over: Partial<LessonVersionRow> = {}): LessonVersionRow {
  return {
    version_id: V_GEN,
    lesson_id: LID,
    number: 1,
    kind: "generated",
    adopted: false,
    content_hash: H1,
    state_vector: SV,
    lesson: make_lesson(),
    draft: null,
    teacher_word_count: 0,
    provenance: prov(),
    dependency_record: [],
    created_by: null,
    stored_at: new Date("2026-10-01T10:00:00Z"),
    ...over,
  };
}

export function lesson_row(over: Partial<LessonRow> = {}): LessonRow {
  return {
    lesson_id: LID,
    unit_id: "G6.U4",
    number: 4,
    type: "Reading",
    title: "Reading closely",
    state: "in_review",
    current_version_id: V_GEN,
    reviewer_id: U_REV,
    last_editor_id: U_REV,
    reviewer_name: "J. Rivera",
    last_editor_name: "J. Rivera",
    schema_version: 1,
    ...over,
  };
}

export function link(over: Partial<AlignmentLinkRow> = {}): AlignmentLinkRow {
  return {
    lesson_id: LID,
    content_hash: H1,
    code: "L.6.4.b",
    address: "G6.U4.L4.Launch",
    role: "I",
    origin: "narrowed",
    asserted_by: "generator",
    confirmed_by: null,
    ...over,
  };
}

export function issue(over: Partial<IssueRow> = {}): IssueRow {
  return {
    issue_id: crock("iss", "6"),
    lesson_id: LID,
    content_hash: H1,
    level: "blocking",
    kind: "rights_to_clear",
    message: "m",
    address: null,
    span_anchor: null,
    related_lesson_id: null,
    code: null,
    resolved_by: null,
    resolution_reason: null,
    resolved_at: null,
    cleared_by: null,
    created_at: new Date("2026-10-01T10:00:00Z"),
    ...over,
  };
}

export function flag(flag_id = "sf-1"): SafetyFlagRow {
  return { flag_id, lesson_id: LID, source_row: 8, teacher_tip_address: null, status: "open", cleared_by: null, note: null, cleared_at: null };
}

export interface World {
  row: LessonRow | null;
  derived: { lesson: StoredLesson; content_hash: string; state_vector: string; schema_version: number } | null;
  versions: LessonVersionRow[];
  snapshot: LessonVersionRow | null;
  links: AlignmentLinkRow[];
  issues: IssueRow[];
  flags: SafetyFlagRow[];
  deps: DependencyState[];
  history: HistoryRow[];
  outline_segments: { kind: "content"; text: string; instruction_shaped: boolean; applies: "apply" }[];
  writes: number;
}

export function make_world(over: Partial<World> = {}): World {
  return {
    row: lesson_row(),
    derived: { lesson: make_lesson(), content_hash: H1, state_vector: SV, schema_version: 1 },
    versions: [version_row()],
    snapshot: null,
    links: [],
    issues: [],
    flags: [],
    deps: [],
    history: [],
    outline_segments: [],
    writes: 0,
    ...over,
  };
}

export function make_service(w: World): LessonReadService {
  const no = (): never => {
    w.writes += 1;
    throw new Error("write attempted");
  };
  const states = {
    get: async () => w.row,
    lock_for_update: no, state_of: no, ensure_lessons: no, set_state: no, append_review_event: no, record_last_editor: no,
  };
  const versions = {
    write_generated_version: no, write_snapshot: no, mark_adopted: no,
    version: async (id: string) => w.versions.find((v) => v.version_id === id) ?? null,
    latest_snapshot: async () => w.snapshot,
    candidate: async () => null,
    has_generated_version: async () => true,
    approved_snapshots: async () => [],
    list_for_lesson: async () => w.versions,
  };
  const reader = {
    latest: async () => null,
    latest_derived: async () =>
      w.derived === null
        ? null
        : { lesson_id: LID, seq: 1, store_id: crock("st", "7"), stored_at: new Date(), stored_by: null, ...w.derived },
  };
  const outlines = {
    rows: async () => [
      {
        outline_version_id: OV,
        row_hash: H1,
        row: {
          row_number: 8, kind: "lesson", lesson_id: LID, number: 4, title: "t", lesson_type: "Reading", arc: null,
          segments: w.outline_segments, focus_codes: [], eld_codes: [], msls_codes: [], vocabulary: [],
          homework: null, pages: null, text_set: null,
        },
      },
    ],
  };
  const alignment = { replace_for_hash: no, confirm: no, restore: no, coverage_rows: no, for_lesson: async () => w.links };
  const suggestions = { insert: no, decide: no, get: async () => null, pending_for: async () => [] };
  const audit = { append: no, standard_decisions: async () => [], history: async () => w.history };
  const issues = {
    replace_for_hash: no, resolve: no,
    current: async () => ({ lesson_id: LID, checked_hash: H1, checked_at: null, issues: w.issues }),
  };
  const flags = { create_for_lesson: no, clear: no, open_for: async () => w.flags };
  const graph = {
    dependencies: async () => w.deps,
    dependants: async () => [],
    source_outline_version: async () => (w.outline_segments.length > 0 || w.row !== null ? OV : null),
  };
  return new LessonReadService(
    states as never, versions as never, reader as never, outlines as never, alignment as never,
    suggestions as never, audit as never, issues as never, flags as never, graph as never,
  );
}

export const user = (role: RequestUser["role"]): RequestUser => ({
  user_id: crock("usr", role === "reviewer" ? "4" : role === "author" ? "8" : "9"),
  name: `Test ${role}`,
  email: `${role}@example.test`,
  role,
  synthetic: true,
  request_id: crock("req", "A"),
});
