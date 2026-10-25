import type { IntakeChoiceRow, LessonLinkRecord, NormalizedOutline, NormalizedRow, OutlineVersionRow, UnitRuleRecord } from "@ls/schema/outline";
import type { LessonId, OutlineVersionId, Sha256, UnitId, UserId } from "./common.ts";
import type { Tx } from "./tx.ts";

// Owned by @ls/schema (NL-09); re-exported so ports and the schema share one definition.
export type { OutlineVersionRow, IntakeChoiceRow, LessonLinkRecord };

export interface UnitRow {
  unit_id: UnitId;
  grade: number;
  title: string;
  latest_outline_version_id: OutlineVersionId | null;
}

export interface NewOutlineVersion {
  unit_id: UnitId;
  sha256: Sha256;
  source_kind: "upload_csv" | "upload_xlsx" | "sheet_link";
  source_name: string;
  uploaded_by: UserId;
}

export interface OutlineRowRecord {
  outline_version_id: OutlineVersionId;
  row: NormalizedRow;
  row_hash: Sha256;
}

export interface RowContext {
  outline_version_id: OutlineVersionId;
  row: NormalizedRow;
  row_hash: Sha256;
  arc_header: string | null;
  neighbours: NormalizedRow[];
  unit_rules: UnitRuleRecord[];
  links: LessonLinkRecord[];
  choices: IntakeChoiceRow[];
}

export interface GateInputs {
  outline: NormalizedOutline;
  choices: IntakeChoiceRow[];
}

export interface OutlineRepo {
  list_units(): Promise<UnitRow[]>;
  insert_version(v: NewOutlineVersion, outline: NormalizedOutline, links: readonly LessonLinkRecord[], tx: Tx): Promise<OutlineVersionRow>;
  version(outline_version_id: OutlineVersionId): Promise<OutlineVersionRow | null>;
  rows(outline_version_id: OutlineVersionId): Promise<OutlineRowRecord[]>;
  choices(outline_version_id: OutlineVersionId): Promise<IntakeChoiceRow[]>;
  upsert_choice(choice: IntakeChoiceRow, tx: Tx): Promise<IntakeChoiceRow>;
  mark_confirmed(outline_version_id: OutlineVersionId, at: Date, tx: Tx): Promise<void>;
  generate_gate_inputs(outline_version_id: OutlineVersionId): Promise<GateInputs>;
  // choices given: applied (the run's copied set); null: the outline version's stored choices
  row_context(outline_version_id: OutlineVersionId, lesson_id: LessonId, choices: readonly IntakeChoiceRow[] | null): Promise<RowContext>;
  links(outline_version_id: OutlineVersionId): Promise<LessonLinkRecord[]>;
}
