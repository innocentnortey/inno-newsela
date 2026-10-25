// Mirrors OpenAPI components for the lesson editor cards (lesson, issues, resolution, fill slot, regenerate, suggestions).
import { z } from "zod";
import { NullableText, ProseMirrorDoc, Sha256, StateVector, Timestamp } from "./common.ts";
import { LessonState, SendBack } from "./board.ts";
import { Segment } from "./outlines.ts";
import { FailureReason } from "./runs.ts";

export const Standard = z.object({
  code: z.string(),
  role: z.enum(["focus", "supporting", "eld"]),
  origin: z.enum(["outline", "outline-fixed", "narrowed", "added"]),
  official_text: z.string(),
  asserted_by: z.enum(["outline", "generator", "judge", "reviewer"]),
  confirmation: z.enum(["open", "confirmed", "removed"]).nullable(),
});
export type Standard = z.infer<typeof Standard>;

export const Section = z.object({
  address: z.string(),
  name: z.string(),
  minutes: z.number().int(),
  content: ProseMirrorDoc,
});
export type Section = z.infer<typeof Section>;

export const RightsStatus = z.enum([
  "public-domain",
  "Newsela-owned",
  "licensed",
  "to-clear",
  "short-quote-commentary",
]);
export type RightsStatus = z.infer<typeof RightsStatus>;

export const TextCard = z.object({
  title: z.string(),
  author: NullableText,
  edition_or_isbn: NullableText,
  chapter: NullableText,
  pages: NullableText,
  kind: z.enum(["off-platform-text", "newsela-reference", "excerpt"]),
  rights_status: RightsStatus.nullable(),
});
export type TextCard = z.infer<typeof TextCard>;

export const AlignmentEntry = z.object({
  code: z.string(),
  teach_links: z.array(z.string()),
  check_links: z.array(z.string()),
  link_role: z.enum(["I", "P", "A"]),
  asserted_by: z.enum(["outline", "generator", "judge", "reviewer"]),
});
export type AlignmentEntry = z.infer<typeof AlignmentEntry>;

export const ChecklistItem = z.object({
  key: z.enum([
    "standards",
    "quotes_and_rights",
    "eld_support",
    "content_safety",
    "ai_spans",
    "dependencies",
  ]),
  label: z.string(),
  status: z.enum(["ok", "open"]),
  evidence_refs: z.array(z.string()),
});
export type ChecklistItem = z.infer<typeof ChecklistItem>;

export const Dependency = z.object({
  direction: z.enum(["waits_on", "depended_on_by"]),
  lesson_id: z.string(),
  slot_id: z.string(),
  status: z.enum(["slot_empty", "waiting_for_source_approval", "source_approved", "source_reopened"]),
});
export type Dependency = z.infer<typeof Dependency>;

export const SnapshotRef = z.object({
  version_id: z.string(),
  content_hash: Sha256,
  state_vector: StateVector,
});
export type SnapshotRef = z.infer<typeof SnapshotRef>;

export const Lesson = z.object({
  lesson_id: z.string(),
  lesson_key: z.string(),
  unit_id: z.string(),
  number: z.number().int().nullable(),
  title: z.string(),
  type: z.string(),
  state: LessonState,
  version_number: z.number().int(),
  content_hash: Sha256,
  state_vector: StateVector,
  schema_version: z.number().int(),
  last_editor: NullableText,
  snapshot: SnapshotRef.nullable(),
  front_matter: z.looseObject({ standards: z.array(Standard) }),
  sections: z.array(Section),
  text_cards: z.array(TextCard),
  outline_row: z.object({
    row_number: z.number().int(),
    segments: z.array(Segment),
  }),
  alignment_map: z.array(AlignmentEntry),
  reviewer: NullableText,
  send_back: SendBack.nullable(),
  checklist: z.array(ChecklistItem),
  dependencies: z.array(Dependency),
  allowed_actions: z.array(z.string()),
});
export type Lesson = z.infer<typeof Lesson>;

export const IssueLevel = z.enum(["blocking", "confirmation", "advisory"]);
export type IssueLevel = z.infer<typeof IssueLevel>;

export const IssueCounts = z.object({
  blocking: z.number().int(),
  confirmation: z.number().int(),
  advisory: z.number().int(),
});
export type IssueCounts = z.infer<typeof IssueCounts>;

export const Issue = z.object({
  issue_id: z.string(),
  level: IssueLevel,
  blocks: z.array(z.enum(["submit", "approve"])),
  resolvable: z.boolean(),
  kind: z.enum([
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
  ]),
  message: z.string(),
  address: NullableText,
  span_anchor: z.string().nullable(),
  related_lesson_id: NullableText,
  resolution: z
    .object({
      by: z.string(),
      reason: z.string(),
      at: Timestamp,
    })
    .nullable(),
});
export type Issue = z.infer<typeof Issue>;

export const IssueList = z.object({
  lesson_id: z.string(),
  stored_hash: Sha256,
  checked_hash: Sha256,
  checked_at: Timestamp,
  pending: z.boolean(),
  counts: IssueCounts,
  issues: z.array(Issue),
});
export type IssueList = z.infer<typeof IssueList>;

export const ResolutionRequest = z.object({ reason: z.string() }).strict();
export type ResolutionRequest = z.infer<typeof ResolutionRequest>;

export const SafetyFlagClearRequest = z.object({ note: z.string() }).strict();
export type SafetyFlagClearRequest = z.infer<typeof SafetyFlagClearRequest>;

export const StandardDecisionRequest = z
  .object({
    code: z.string(),
    decision: z.enum(["confirm", "remove", "add", "undo"]),
    undo_of: z.string().nullable().optional(),
  })
  .strict();
export type StandardDecisionRequest = z.infer<typeof StandardDecisionRequest>;

export const ResolveResult = z.object({
  item_id: z.string(),
  status: z.enum(["resolved", "cleared", "confirmed", "removed", "added", "undone"]),
  by: z.string(),
  at: Timestamp,
  audit_id: z.string(),
  counts: IssueCounts,
});
export type ResolveResult = z.infer<typeof ResolveResult>;

export const SourceRef = z.object({
  title: z.string(),
  chapter: NullableText.optional(),
  pages: NullableText.optional(),
  url: z.url().nullable().optional(),
});
export type SourceRef = z.infer<typeof SourceRef>;

export const FillSlotRequest = z
  .object({
    text: z.string().min(1).max(10000),
    source_ref: SourceRef,
    rights_status: RightsStatus,
  })
  .strict();
export type FillSlotRequest = z.infer<typeof FillSlotRequest>;

export const FillSlotResult = z.object({
  slot_id: z.string(),
  inserted_by: z.string(),
  inserted_at: Timestamp,
  content_hash: Sha256,
  still_blocking: z.boolean(),
  blocking_reason: NullableText,
  linked_lessons: z.array(
    z.object({
      lesson_id: z.string(),
      status: z.enum(["slot_empty", "waiting_for_source_approval", "source_approved"]),
    }),
  ),
});
export type FillSlotResult = z.infer<typeof FillSlotResult>;

export const RegenerateRequest = z.object({ note: NullableText.optional() }).strict();
export type RegenerateRequest = z.infer<typeof RegenerateRequest>;

export const Candidate = z.object({
  candidate_id: z.string(),
  version_number: z.number().int(),
  status: z.enum(["queued", "drafting", "ready", "failed"]),
  adopted: z.boolean(),
  failure_reasons: z.array(FailureReason),
  cost_usd: z.number(),
  current_content_hash: Sha256,
  sections: z.array(Section),
});
export type Candidate = z.infer<typeof Candidate>;

export const AdoptRequest = z
  .object({
    scope: z.enum(["whole", "section"]),
    section_address: NullableText.optional(),
  })
  .strict();
export type AdoptRequest = z.infer<typeof AdoptRequest>;

export const AdoptResult = z.object({
  candidate_id: z.string(),
  audit_id: z.string(),
  last_editor: z.string(),
  content_hash: Sha256,
});
export type AdoptResult = z.infer<typeof AdoptResult>;

export const Anchor = z.object({ start: z.string(), end: z.string() });
export type Anchor = z.infer<typeof Anchor>;

export const SuggestionRequest = z
  .object({
    anchor: Anchor,
    selected_text: z.string().min(1).max(2000),
    note: z.string(),
  })
  .strict();
export type SuggestionRequest = z.infer<typeof SuggestionRequest>;

export const SuggestionDecisionRequest = z
  .object({
    decision: z.enum(["accept", "reject"]),
    anchored_text_now: z.string().nullable().optional(),
  })
  .strict();
export type SuggestionDecisionRequest = z.infer<typeof SuggestionDecisionRequest>;

export const Suggestion = z.object({
  suggestion_id: z.string(),
  status: z.enum(["pending", "accepted", "rejected", "closed"]),
  anchor: Anchor,
  selected_text: z.string(),
  suggested_text: z.string(),
  requested_by: z.string(),
  expires_at: Timestamp,
  decided_by: NullableText,
  content_hash: z.string().nullable(),
});
export type Suggestion = z.infer<typeof Suggestion>;

export const SuggestionList = z.object({ suggestions: z.array(Suggestion) });
export type SuggestionList = z.infer<typeof SuggestionList>;
