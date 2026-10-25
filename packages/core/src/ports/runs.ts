import type { UnitPlanDraft } from "@ls/schema/unit-plan";
import type { CapName, ModelCallId, OutlineVersionId, RunId, RunKind, RunStateName, Sha256, UnitId, UserId, Usd } from "./common.ts";
import type { JobRow } from "./job-queue.ts";
import type { RunCallTotals } from "./model-call-log.ts";
import type { IntakeChoiceRow, LessonLinkRecord } from "./outlines.ts";
import type { Tx } from "./tx.ts";

export interface NewRun {
  unit_id: UnitId;
  outline_version_id: OutlineVersionId;
  kind: RunKind;
  prompt_version_id: string;
  cap_usd: Usd;
  scope_rows: number[] | null;
  started_by: UserId;
  parent_run_id: RunId | null;
  eval_run_id: string | null;
  choices: IntakeChoiceRow[]; // copied at start
  choices_hash: Sha256;
  lesson_links: LessonLinkRecord[];
  idempotency_key: string | null;
}

export interface RunRow {
  run_id: RunId;
  unit_id: UnitId;
  outline_version_id: OutlineVersionId;
  kind: RunKind;
  state: RunStateName;
  prompt_version_id: string;
  cap_usd: Usd;
  started_by: UserId;
  parent_run_id: RunId | null;
  plan_stored_at: Date | null;
  paused_check: string | null;
  capped_by: CapName | null;
  choices_hash: Sha256;
  created_at: Date;
  finished_at: Date | null;
}

export interface UnitPlanRow {
  run_id: RunId;
  state: "planning" | "stored" | "failed";
  plan: UnitPlanDraft | null;
  lesson_links: LessonLinkRecord[];
  model_call_id: ModelCallId | null;
  stored_at: Date | null;
}

export interface RunSummaryRows {
  run: RunRow;
  jobs: JobRow[];
  calls: RunCallTotals;
  placeholders_left: number;
  report_path: string | null;
}

export interface RunRepo {
  insert_run(run: NewRun, tx: Tx): Promise<RunRow>;
  get(run_id: RunId): Promise<RunRow | null>;
  find_by_idempotency_key(user_id: UserId, key: string, within_hours: number): Promise<RunRow | null>;
  lock_for_update(run_id: RunId, tx: Tx): Promise<RunRow>;
  set_state(run_id: RunId, state: RunStateName, paused_check: string | null, tx: Tx): Promise<RunRow>;
  mark_capped(run_id: RunId, capped_by: CapName, tx: Tx): Promise<RunRow>;
  pinned_choices(run_id: RunId): Promise<IntakeChoiceRow[]>;
  mark_plan_failed(run_id: RunId, tx: Tx): Promise<RunRow>;
  store_unit_plan(run_id: RunId, plan: UnitPlanDraft, model_call_id: ModelCallId): Promise<UnitPlanRow>;
  unit_plan(run_id: RunId): Promise<UnitPlanRow | null>;
  summary_rows(run_id: RunId): Promise<RunSummaryRows>;
  active_runs(): Promise<RunRow[]>;
}
