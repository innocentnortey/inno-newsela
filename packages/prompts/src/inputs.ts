import type { LessonLinkRecord, NormalizedRow, UnitRuleRecord } from "@ls/schema/outline";
import type { UnitPlanEntryDraft } from "@ls/schema/unit-plan";

import type { PromptBlock } from "@ls/core/ports/model-client";
export type { PromptBlock };

// Local structural types: the DO-4 records satisfy these.
export interface PromptVersionRow {
  prompt_version_id: string;
  number: number;
  locked_hash: string;
  guidance_text: string;
}
export interface PromptFinding {
  kind: string;
  message: string;
  address: string | null;
}
export interface PromptSection {
  name: string;
  minutes: number;
  required_roles: readonly string[];
}
export interface PromptSectionTemplate {
  sections: readonly PromptSection[];
}
export interface PromptStandard {
  code: string;
  text: string;
}
export interface PromptRowContext {
  row: NormalizedRow;
  arc_header: string | null;
  neighbours: readonly NormalizedRow[];
  unit_rules: readonly UnitRuleRecord[];
  links: readonly LessonLinkRecord[];
}
export interface RenderedPrompt {
  prompt_version_id: string;
  locked_hash: string;
  system_blocks: PromptBlock[];
  user_blocks: PromptBlock[];
  text: string;
  input_tokens_estimate: number;
}
export interface UnitPlanPromptInput {
  run_id: string;
  prompt: PromptVersionRow;
  rows: readonly NormalizedRow[];
  unit_rules: readonly UnitRuleRecord[];
  links: readonly LessonLinkRecord[];
  repair_of: { draft_raw: string; issues: readonly string[] } | null;
}
export interface DraftPromptInput {
  prompt: PromptVersionRow;
  context: PromptRowContext;
  plan_entries: readonly UnitPlanEntryDraft[];
  standards: readonly PromptStandard[];
  template: PromptSectionTemplate;
  example_set_id: string | null;
  reviewer_note: string | null;
}
export interface RepairPromptInput {
  prompt: PromptVersionRow;
  draft_raw: string;
  failing: readonly PromptFinding[];
  schema_issues: readonly string[];
  template: PromptSectionTemplate;
}
export interface AssistPromptInput {
  prompt: PromptVersionRow;
  selected_text: string;
  note: string;
  section_name: string;
}
export interface JudgePromptInput {
  standard_text: string;
  activity_text: string;
  question: "teaches_standard" | "eld_keeps_task";
  rubric_version: string;
  /** Required at runtime: render_judge throws when absent (optional in the type only because the frozen fixture builds inputs without it). */
  expected_locked_hash?: string;
}
