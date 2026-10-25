import type { StoredLesson } from "@ls/schema/lesson";
import type { NormalizedRow } from "@ls/schema/outline";
import type { TextCardRecord } from "@ls/schema/lesson-draft";
import type { LessonId, UserId, Sha256 } from "@ls/schema/ids";
import type { z } from "zod";
import type { ApiErrorCode as ApiErrorCodeSchema } from "@ls/schema/api/common";

export type ApiErrorCode = z.infer<typeof ApiErrorCodeSchema>;

// DO-4 section 2 order. Includes schema_invalid (the OpenAPI enum lacks it: contract gap, see plan Deviations).
export const CHECK_KINDS = [
  "quote_placeholder_open",
  "excerpt_slot_open",
  "cross_lesson_link",
  "standard_not_taught",
  "standard_not_checked",
  "code_not_allowed",
  "minutes_out_of_range",
  "section_missing",
  "schema_invalid",
  "quote_unmatched",
  "page_out_of_range",
  "proper_noun_unsourced",
  "quote_without_source",
  "quote_too_long",
  "rights_to_clear",
  "suggestion_pending",
  "safety_flag_open",
  "safety_note_without_tip",
  "safety_text_in_student_block",
  "disclosure_prompt",
  "standard_confirmation",
  "standard_add_suggestion",
  "eld_label_mismatch",
  "arc_repeat",
  "vocabulary_over_cap",
  "vocabulary_word_missing",
  "linked_text_changed",
  "judge_no",
] as const;
export type CheckKind = (typeof CHECK_KINDS)[number];

export type IssueLevelName = "blocking" | "confirmation" | "advisory";

export type CheckPolicy = {
  readonly quote_span_min_words: number;
  readonly reviewer_quote_max_words: number;
  readonly quote_and_page_scans: "blocking_everywhere";
  readonly name_scan_scope: "blocking_in_cfu_items" | "blocking_everywhere";
  readonly name_scan_engine: "heuristic_plus_compromise";
  readonly minutes_target: number;
  readonly minutes_tolerance: number;
  readonly vocabulary_cap: number;
  readonly safety_run_min_words: number;
};

export type StandardRow = {
  code: string;
  set: "CA_CCSS_ELA_6" | "CA_ELD_6" | "MSLS_6";
  text: string;
  parent_code: string | null;
  is_leaf: boolean;
  eld_strand: string | null;
};

export type DerivedRow = {
  lesson_id: LessonId;
  seq: number;
  store_id: string;
  lesson: StoredLesson;
  content_hash: Sha256;
};

export type SuggestionRow = {
  suggestion_id: string;
  lesson_id: LessonId;
  anchor_start: string;
  anchor_end: string;
  selected_text: string;
  suggested_text: string;
  status: "pending" | "accepted" | "rejected" | "closed";
};

export type SafetyFlagRow = {
  flag_id: string;
  lesson_id: LessonId;
  source_row: number;
  teacher_tip_address: string | null;
  status: "open" | "cleared";
  note: string | null;
};

export type AlignmentLinkRow = {
  lesson_id: LessonId;
  content_hash: Sha256;
  code: string;
  address: string;
  role: "I" | "P" | "A";
  origin: "outline" | "narrowed" | "added";
  asserted_by: "outline" | "generator" | "judge" | "reviewer";
  confirmed_by: string | null;
};

export type LessonLinkRecord = {
  link_id: string;
  from_lesson_id: LessonId;
  from_address: string;
  to_lesson_id: LessonId;
  to_slot_id: string;
  kind: "homework_text" | "excerpt_slot" | "page_continuation";
  label: string;
};

export type CoverageCell = { code: string; lesson_id: LessonId };

export type RecordedResolution = {
  kind: CheckKind;
  address: string | null;
  code: string | null;
};

export type DependencyState = {
  direction: "waits_on" | "depended_on_by";
  lesson_id: LessonId;
  slot_id: string;
  source_state: string;
  slot_filled: boolean;
  source_approved_hash: string | null;
};

export type CheckContext = {
  lesson_id: LessonId;
  content_hash: Sha256;
  outline_version_id: string;
  lesson: StoredLesson;
  row: NormalizedRow;
  arc_header: string | null;
  allowed_codes: string[];
  standards: StandardRow[];
  text_cards: TextCardRecord[];
  links: LessonLinkRecord[];
  linked_lessons: DerivedRow[];
  pending_suggestions: SuggestionRow[];
  safety_flags: SafetyFlagRow[];
  confirmations: AlignmentLinkRow[];
  previous_lesson_flags: SafetyFlagRow[];
  unit_coverage: CoverageCell[];
};

export type CheckFinding = {
  kind: CheckKind;
  level: IssueLevelName;
  message: string;
  address: string | null;
  span_anchor: string | null;
  related_lesson_id: LessonId | null;
  code: string | null;
};

export type CheckResult = {
  content_hash: Sha256;
  findings: CheckFinding[];
  alignment: AlignmentLinkRow[];
  blocking: number;
  confirmation: number;
  advisory: number;
  first_failing_kind: CheckKind | null;
};

export type CheckRule = {
  readonly kind: CheckKind;
  readonly level: IssueLevelName;
  run(ctx: CheckContext, policy: CheckPolicy): CheckFinding[];
};
export type CheckRuleList = readonly CheckRule[];

export type GateIssue = {
  kind: CheckKind;
  level: IssueLevelName;
  message: string;
  address: string | null;
  code: string | null;
  related_lesson_id: LessonId | null;
  resolved: boolean;
};

export type GateState = {
  action: "submit" | "approve";
  issues: GateIssue[];
  pending_check: boolean;
  pending_suggestions: number;
  open_confirmations: number;
  last_editor_id: UserId | null;
  approver_id: UserId | null;
  four_eyes_enabled: boolean;
  dependencies: DependencyState[];
};

export type JsonValue =
  string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

export type GateDecision = {
  allowed: boolean;
  refusals: ApiErrorCode[];
  details: JsonValue;
};
