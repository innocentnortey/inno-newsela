// Astra slice B: the facts behind the S9 full-run report, collected from stored rows through narrow read ports.
// Each stage has its own count and denominator; the original draft output is validated, not inferred from repairs.
import Decimal from "decimal.js";
import type { CheckKind, RunId, Usd } from "@ls/core/ports/common";
import type { ModelCallLog } from "@ls/core/ports/model-call-log";
import type { OutlineRepo } from "@ls/core/ports/outlines";
import type { RunRepo } from "@ls/core/ports/runs";
import type { RunReportFacts } from "@ls/db/repos/runs-report";
import type { NormalizedRow } from "@ls/schema/outline";
import { assess_initial_draft, parse_valid, type InitialDraftStage } from "./full-run-initial.ts";

export interface FullRunReadPorts {
  runs: Pick<RunRepo, "summary_rows"> & { report_facts(run_id: RunId): Promise<RunReportFacts> };
  calls: Pick<ModelCallLog, "totals_for_run" | "completed_for">;
  outlines: Pick<OutlineRepo, "rows">;
}
export interface StageCount { count: number; denominator: number }
export interface FullRunStages {
  initial: {
    parse_valid: StageCount;
    compiled: StageCount;
    no_output: number;
    unparseable: number;
    schema_invalid: number;
    compile_error: number;
    invalid_issue_paths: Record<string, number>;
    check_clean: StageCount;
  };
  repair: { attempted: number; recovered: StageCount; outputs: number; output_compiled: StageCount };
  stored: { ready: StageCount; failed: StageCount };
  review: {
    lessons_checked: number; lessons_pending: number; lessons_with_blockers: number;
    blocking_by_kind: Record<string, number>; open_by_kind: Record<string, number>; checked_through: number | null;
  };
  open_slots: { quote_placeholder: number; excerpt_slot: number; total: number; lessons_with_slots: number };
}
export interface FailureRecord { lesson_id: string; finished_at: number | null; reasons: string[] }
export interface LessonFact {
  lesson_id: string;
  tile_state: string;
  queued_at: number;
  repairs: number;
  cost_usd: Usd;
  confirmations: number | null;
  round_trip: boolean | null;
  first_failure: string | null;
  terminal_ok: boolean;
  initial_stage: InitialDraftStage;
  repair_stage: InitialDraftStage | null;
  slot_nodes: number;
  check_state: "checked" | "pending" | "no_version";
  blocking_open: number;
  reasons: string[];
  finished_at: number | null;
}
export interface FullRunFacts {
  run_id: RunId;
  cap_usd: Usd;
  n: number;
  n_ready: number;
  /** Original draft outputs that parse as LessonDraft AND compile (M-31). Repairs never change it. */
  first_pass_schema_valid: number;
  /** Lesson jobs that reached ready or failed, i.e. actually ran. A rate over zero of these means nothing. */
  lessons_run: number;
  /** Sum of lesson-job repairs (the unit-plan repair call is not a lesson repair). */
  repairs: number;
  failures_by_reason: Record<string, number>;
  failures_first_by_reason: Record<string, number>;
  failure_chronology: FailureRecord[];
  placeholders: number;
  grounding_flags_by_kind: Record<string, number>;
  disclosure_prompts_l31_l32: number;
  confirmations: number;
  round_trip_ok: number;
  round_trip_total: number;
  cost_usd: Usd;
  jobs_cost: Usd;
  /** Completed calls with no job (the unit-plan call). */
  unattributed_cost: Usd;
  /** Cost carried on non-lesson job rows (non-zero once the worker rolls the unit-plan call up). */
  plan_job_cost: Usd;
  job_cost_mismatches: string[];
  prompt_version_id: string | null;
  models_used: { purpose: string; requested: string; served: string | null }[];
  per_lesson_max: Usd;
  wall_s: number;
  p95_minutes: number | null;
  all_terminal: boolean;
  checks_pending: number;
  checked_through: number | null;
  stages: FullRunStages;
  lessons: LessonFact[];
}

export const GROUNDING_KINDS: readonly CheckKind[] = [
  "quote_unmatched", "page_out_of_range", "proper_noun_unsourced", "quote_without_source", "quote_too_long", "rights_to_clear",
];

/** `check_failed:proper_noun_unsourced` for a check with a kind, the bare check name otherwise. */
export const reason_key = (r: { check: string; check_kind?: string | null }): string => (r.check_kind ? `${r.check}:${r.check_kind}` : r.check);

function sorted_counts(m: Map<string, number>): Record<string, number> {
  return Object.fromEntries([...m.entries()].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));
}
function bump(m: Map<string, number>, k: string, by = 1): void {
  m.set(k, (m.get(k) ?? 0) + by);
}
const cmp = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

export async function collect_full_run_facts(run_id: RunId, ports: FullRunReadPorts): Promise<FullRunFacts> {
  const rows = await ports.runs.summary_rows(run_id);
  const totals = await ports.calls.totals_for_run(run_id);
  const rf = await ports.runs.report_facts(run_id);
  const outline = new Map<string, NormalizedRow>((await ports.outlines.rows(rows.run.outline_version_id)).map((r) => [r.row.lesson_id as string, r.row]));
  const rf_by_lesson = new Map(rf.lessons.map((l) => [l.lesson_id as string, l]));
  const is_lesson = (j: { kind: string; lesson_id: string | null }): boolean => j.kind === "lesson" && j.lesson_id !== null;
  const jobs = rows.jobs.filter(is_lesson);
  const plan_job_cost = rows.jobs.filter((j) => !is_lesson(j)).reduce((acc, j) => acc.plus(j.cost_usd), new Decimal(0));

  const failures = new Map<string, number>();
  const failures_first = new Map<string, number>();
  const chronology: FailureRecord[] = [];
  const grounding = new Map<string, number>();
  const open_by_kind = new Map<string, number>();
  const blocking_by_kind = new Map<string, number>();
  const invalid_paths = new Map<string, number>();
  const lessons: LessonFact[] = [];
  const confirm_counts: number[] = [];
  const mismatches: string[] = [];
  const minutes: number[] = [];
  let lessons_run = 0, repairs = 0, disclosure = 0, rt_ok = 0, rt_total = 0, all_terminal = true;
  let jobs_cost = new Decimal(0);
  let per_lesson_max = new Decimal(0);
  const initial = { parse: 0, compiled: 0, none: 0, unparseable: 0, schema: 0, compile: 0, clean: 0 };
  const rep = { attempted: 0, recovered: 0, outputs: 0, compiled: 0 };
  let stored_ready = 0, stored_failed = 0;
  const review = { checked: 0, pending: 0, blockers: 0, through: null as number | null };
  const slots = { quote_placeholder: 0, excerpt_slot: 0, lessons: 0 };

  for (const j of jobs) {
    const lesson_id = j.lesson_id as string;
    const ran = j.tile_state === "ready" || j.tile_state === "failed";
    const lesson = rf_by_lesson.get(lesson_id);
    const row = outline.get(lesson_id) ?? null;
    const actx = { row, unit_id: rows.run.unit_id, schema_version: lesson?.version?.schema_version ?? 1 };
    const first = ran ? await ports.calls.completed_for(j.job_id, "lesson_draft", 1) : null;
    const a = assess_initial_draft(first?.raw_output ?? null, actx);
    let repair_stage: InitialDraftStage | null = null;
    if (ran) {
      lessons_run++;
      if (a.stage === "no_output") initial.none++;
      else if (a.stage === "unparseable") initial.unparseable++;
      else if (a.stage === "schema_invalid") initial.schema++;
      else if (a.stage === "compile_error") initial.compile++;
      if (parse_valid(a.stage)) initial.parse++;
      if (a.stage === "compiled") initial.compiled++;
      if (a.stage === "schema_invalid") {
        for (const p of a.issue_paths) bump(invalid_paths, p.split(".").filter((s) => !/^\d+$/.test(s)).join(".") || "$");
      }
      if (a.stage === "compiled" && j.repairs === 0 && j.truncation_retries === 0 && j.tile_state === "ready") initial.clean++;
      if (j.repairs >= 1) {
        rep.attempted++;
        if (j.tile_state === "ready") rep.recovered++;
        const r = await ports.calls.completed_for(j.job_id, "repair", 1);
        if (r !== null && r.raw_output) {
          repair_stage = assess_initial_draft(r.raw_output, actx).stage;
          rep.outputs++;
          if (repair_stage === "compiled") rep.compiled++;
        }
      }
      if (j.tile_state === "ready") stored_ready++;
      else stored_failed++;
    }
    repairs += j.repairs;
    const reasons = j.failure_reasons.map(reason_key);
    for (const k of reasons) bump(failures, k);
    if (reasons[0] !== undefined) bump(failures_first, reasons[0]);
    if (j.tile_state === "failed") chronology.push({ lesson_id, finished_at: j.finished_at?.getTime() ?? null, reasons });
    jobs_cost = jobs_cost.plus(j.cost_usd);
    if (j.cost_usd.gt(per_lesson_max)) per_lesson_max = j.cost_usd;
    if (lesson !== undefined && !lesson.calls_cost_usd.eq(j.cost_usd)) mismatches.push(lesson_id);
    if (j.started_at !== null && j.finished_at !== null) minutes.push((j.finished_at.getTime() - j.started_at.getTime()) / 60000);
    const terminal_ok = j.tile_state === "ready" || (j.tile_state === "failed" && j.failure_reasons.length >= 1);
    if (!terminal_ok) all_terminal = false;

    const check_state = lesson?.check.state ?? "no_version";
    let blocking_open = 0;
    let slot_total = 0;
    let confirmations: number | null = null;
    let round_trip: boolean | null = null;
    if (lesson !== undefined && lesson.version !== null) {
      confirmations = lesson.unconfirmed_alignment;
      confirm_counts.push(confirmations);
      slot_total = lesson.slot_nodes.quote_placeholder + lesson.slot_nodes.excerpt_slot;
    }
    if (j.tile_state === "ready") {
      round_trip = lesson !== undefined && lesson.version !== null && lesson.seed_doc_hash !== null && lesson.seed_doc_hash === lesson.version.content_hash;
      rt_total++;
      if (round_trip) rt_ok++;
      if (lesson !== undefined && lesson.version !== null) {
        slots.quote_placeholder += lesson.slot_nodes.quote_placeholder;
        slots.excerpt_slot += lesson.slot_nodes.excerpt_slot;
        if (slot_total > 0) slots.lessons++;
      }
      if (check_state === "checked" && lesson !== undefined) {
        review.checked++;
        const at = lesson.check.checked_at?.getTime() ?? null;
        if (at !== null && (review.through === null || at > review.through)) review.through = at;
        for (const i of lesson.open_issues) {
          bump(open_by_kind, i.kind, i.count);
          if ((GROUNDING_KINDS as readonly string[]).includes(i.kind)) bump(grounding, i.kind, i.count);
          if (i.kind === "disclosure_prompt" && /\.L3[12]$/.test(lesson_id)) disclosure += i.count;
          if (i.level === "blocking") { bump(blocking_by_kind, i.kind, i.count); blocking_open += i.count; }
        }
        if (blocking_open > 0) review.blockers++;
      } else review.pending++;
    }
    lessons.push({
      lesson_id, tile_state: j.tile_state, queued_at: j.queued_at.getTime(), repairs: j.repairs, cost_usd: j.cost_usd,
      confirmations, round_trip, first_failure: reasons[0] ?? null, terminal_ok, initial_stage: a.stage, repair_stage,
      slot_nodes: slot_total, check_state, blocking_open, reasons, finished_at: j.finished_at?.getTime() ?? null,
    });
  }
  lessons.sort((a, b) => a.queued_at - b.queued_at || cmp(a.lesson_id, b.lesson_id));
  chronology.sort((a, b) => (a.finished_at ?? Infinity) - (b.finished_at ?? Infinity) || cmp(a.lesson_id, b.lesson_id));

  confirm_counts.sort((a, b) => a - b);
  let confirmations = 0;
  if (confirm_counts.length > 0) {
    const mid = confirm_counts.length >> 1;
    confirmations = confirm_counts.length % 2 === 1 ? (confirm_counts[mid] as number) : Math.ceil(((confirm_counts[mid - 1] as number) + (confirm_counts[mid] as number)) / 2);
  }
  minutes.sort((a, b) => a - b);
  const p95_minutes = minutes.length === 0 ? null : (minutes[Math.ceil(0.95 * minutes.length) - 1] as number);
  const end = rows.run.finished_at ?? rows.run.created_at;
  const n = jobs.length;
  const sc = (count: number): StageCount => ({ count, denominator: n });
  const open_total = slots.quote_placeholder + slots.excerpt_slot;
  return {
    run_id, cap_usd: rows.run.cap_usd, n, n_ready: jobs.filter((j) => j.tile_state === "ready").length,
    first_pass_schema_valid: initial.compiled, lessons_run, repairs,
    failures_by_reason: sorted_counts(failures), failures_first_by_reason: sorted_counts(failures_first), failure_chronology: chronology,
    placeholders: open_total, grounding_flags_by_kind: sorted_counts(grounding), disclosure_prompts_l31_l32: disclosure,
    confirmations, round_trip_ok: rt_ok, round_trip_total: rt_total, cost_usd: totals.cost_usd, jobs_cost,
    unattributed_cost: totals.unattributed_cost_usd ?? new Decimal(0), plan_job_cost, job_cost_mismatches: mismatches,
    prompt_version_id: rows.run.prompt_version_id, models_used: totals.models_used ?? [], per_lesson_max,
    wall_s: (end.getTime() - rows.run.created_at.getTime()) / 1000, p95_minutes, all_terminal,
    // Review-scoped watermark: only ready lessons are checked for the report, so pending means a ready lesson not yet checked.
    checks_pending: review.pending, checked_through: review.through,
    stages: {
      initial: {
        parse_valid: sc(initial.parse), compiled: sc(initial.compiled), no_output: initial.none, unparseable: initial.unparseable,
        schema_invalid: initial.schema, compile_error: initial.compile, invalid_issue_paths: sorted_counts(invalid_paths), check_clean: sc(initial.clean),
      },
      repair: {
        attempted: rep.attempted, recovered: { count: rep.recovered, denominator: rep.attempted }, outputs: rep.outputs,
        output_compiled: { count: rep.compiled, denominator: rep.outputs },
      },
      stored: { ready: sc(stored_ready), failed: sc(stored_failed) },
      review: {
        lessons_checked: review.checked, lessons_pending: review.pending, lessons_with_blockers: review.blockers,
        blocking_by_kind: sorted_counts(blocking_by_kind), open_by_kind: sorted_counts(open_by_kind), checked_through: review.through,
      },
      open_slots: { quote_placeholder: slots.quote_placeholder, excerpt_slot: slots.excerpt_slot, total: open_total, lessons_with_slots: slots.lessons },
    },
    lessons,
  };
}
