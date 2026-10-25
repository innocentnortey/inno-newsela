// NL-78: pure builders for the run read routes (progress tiles, plan links, summary). No I/O, no clock.
import type { Usd } from "@ls/core/ports/common";
import type { RunCallTotals } from "@ls/core/ports/model-call-log";
import type { ProgressJobRow, RunProgressRows } from "@ls/core/ports/run-progress";
import type { RunSummaryRows } from "@ls/core/ports/runs";
import type { LessonLinkRecord } from "@ls/core/ports/outlines";
import { tile_state } from "@ls/core/lifecycle/run-machine";
import { FAILURE_MESSAGES } from "@ls/core/pipeline/failure-reasons";
import type { FailureCheck } from "@ls/core/pipeline/state";
import { FailureReason, TileState, type LessonLink, type RunProgress, type RunSummary, type Tile } from "@ls/schema/api/runs";

export type RunSummaryResult = RunSummary & { trace_incomplete: boolean };

const CHECKS: readonly string[] = FailureReason.shape.check.options;

export function lesson_key_of(lesson_id: string): string {
  return lesson_id.slice(lesson_id.lastIndexOf(".") + 1);
}

function reasons_of(j: ProgressJobRow): FailureReason[] {
  const out: FailureReason[] = [];
  for (const r of j.failure_reasons as Array<{ check: string; check_kind?: string | null; message?: string }>) {
    if (!CHECKS.includes(r.check)) continue;
    const message = r.message && r.message.length > 0 ? r.message : FAILURE_MESSAGES[r.check as FailureCheck];
    out.push({ check: r.check as FailureReason["check"], check_kind: r.check_kind ?? null, message });
  }
  return out;
}

function compare_jobs(a: ProgressJobRow, b: ProgressJobRow): number {
  if (a.lesson_number !== b.lesson_number) {
    if (a.lesson_number === null) return 1;
    if (b.lesson_number === null) return -1;
    return a.lesson_number - b.lesson_number;
  }
  return (a.lesson_id ?? "").localeCompare(b.lesson_id ?? "", "en", { numeric: true });
}

export function build_progress(rows: RunProgressRows, concurrency_cap: number): RunProgress {
  const { run } = rows;
  const jobs = rows.jobs.filter((j) => j.kind !== "unit_plan" && j.lesson_id !== null).sort(compare_jobs);
  const tiles: Tile[] = jobs.map((j) => {
    const lesson_id = j.lesson_id as string;
    const key = lesson_key_of(lesson_id);
    const ts = tile_state({ status: j.status, tile_state: j.tile_state, kind: j.kind, failure_check: null });
    return {
      lesson_id, lesson_key: key, number: j.lesson_number, title: j.lesson_title ?? key, tile_state: ts, attempts: j.attempt,
      repair_used: j.repairs > 0, truncation_retry_used: j.truncation_retries > 0,
      failure_reasons: ts === "failed" ? reasons_of(j) : [], cost_usd: j.cost_usd.toNumber(), openable: ts === "ready",
    };
  });
  const counts: Record<string, number> = {};
  for (const s of TileState.options) counts[s] = 0;
  for (const t of tiles) counts[t.tile_state] = (counts[t.tile_state] ?? 0) + 1;
  const paused_reason =
    run.state === "paused" && run.paused_check !== null
      ? {
          check: run.paused_check,
          lesson_ids: tiles.filter((t) => t.tile_state === "failed" && t.failure_reasons.some((r) => r.check === run.paused_check)).map((t) => t.lesson_id),
        }
      : null;
  const stamps: number[] = [run.created_at, run.plan_stored_at, run.finished_at]
    .concat(rows.jobs.flatMap((j) => [j.queued_at, j.started_at, j.finished_at]))
    .filter((d): d is Date => d !== null)
    .map((d) => d.getTime());
  return {
    run_id: run.run_id, state: run.state, paused_reason, capped_by: run.capped_by, spent_usd: rows.settled_usd.toNumber(),
    reserved_usd: rows.reserved_usd.toNumber(), cap_usd: run.cap_usd.toNumber(), concurrency_cap, queued_ahead: rows.queued_ahead,
    counts_by_tile_state: counts, updated_at: new Date(Math.max(...stamps)).toISOString(), tiles,
  };
}

export function plan_links(l: LessonLinkRecord): LessonLink {
  return { link_id: l.link_id, from_lesson_id: l.from_lesson_id, from_address: l.from_address, to_lesson_id: l.to_lesson_id, to_slot_id: l.to_slot_id, label: l.label };
}

/** Nearest rank. */
export function p95(values: number[]): number | null {
  if (values.length === 0) return null;
  const s = [...values].sort((a, b) => a - b);
  return s[Math.ceil(0.95 * s.length) - 1] ?? null;
}

function tally(names: string[]): Array<[string, number]> {
  const m = new Map<string, number>();
  for (const n of names) m.set(n, (m.get(n) ?? 0) + 1);
  return [...m.entries()].sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
}

export function build_summary(rows: RunSummaryRows, totals: RunCallTotals, settled_usd: Usd, now: Date): RunSummaryResult {
  const { run } = rows;
  const work = rows.jobs.filter((j) => j.kind === "lesson" || j.kind === "candidate");
  const ready = work.filter((j) => j.status === "ready").length;
  const lost = work.filter((j) => j.status === "generation_failed" || j.status === "cancelled");
  const minutes = work
    .filter((j) => j.started_at !== null && j.finished_at !== null && (j.status === "ready" || j.status === "generation_failed"))
    .map((j) => ((j.finished_at as Date).getTime() - (j.started_at as Date).getTime()) / 60000);
  return {
    run_id: run.run_id, state: run.state, n: work.length,
    wall_time_seconds: Math.max(0, Math.floor(((run.finished_at ?? now).getTime() - run.created_at.getTime()) / 1000)),
    cost_usd: totals.cost_usd.toNumber(),
    // Failed attempts' cost stays in the numerator (GP-107).
    cost_per_ready_lesson_usd: ready === 0 ? null : totals.cost_usd.div(ready).toNumber(),
    lessons: { ready, failed: lost.length }, retries: totals.retries,
    failures_by_reason: tally(lost.flatMap((j) => [...new Set(j.failure_reasons.map((r) => r.check))])).map(([reason, count]) => ({ reason, count })),
    placeholders_left: rows.placeholders_left,
    calls_lost_in_flight: rows.jobs.reduce((n, j) => n + j.calls_lost, 0),
    brakes_fired: tally(rows.jobs.flatMap((j) => j.brakes_fired)).map(([brake, count]) => ({ brake, count })),
    truncation_retries: totals.truncation_retries, p95_minutes_per_lesson: p95(minutes), target_minutes_per_lesson: 5,
    report_path: rows.report_path,
    // DO-6 completeness check 1: run spend vs the call sum, at Decimal precision.
    trace_incomplete: !settled_usd.eq(totals.cost_usd),
  };
}
