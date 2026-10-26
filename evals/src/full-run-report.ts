// NL-86 (A20): the S9 full-run report, built only from stored rows read through narrow ports.
import fs from "node:fs";
import path from "node:path";
import Decimal from "decimal.js";
import type { AlignmentRepo } from "@ls/core/ports/alignment";
import type { CheckKind, JsonValue, LessonId, RunId, Usd } from "@ls/core/ports/common";
import type { EvidenceRepo } from "@ls/core/ports/evidence";
import type { IssueRepo } from "@ls/core/ports/issues";
import type { LessonDocReader } from "@ls/core/ports/lesson-docs";
import type { LessonVersionRow } from "@ls/core/ports/lesson-versions";
import type { ModelCallLog } from "@ls/core/ports/model-call-log";
import type { RunRepo } from "@ls/core/ports/runs";
import { make_leak_guard } from "./leak-guard.ts";
import type { ProviderMode } from "./types.ts";

export interface GeneratedVersionReader {
  generated_version(lesson_id: LessonId): Promise<LessonVersionRow | null>;
}
export interface FullRunReadPorts {
  runs: Pick<RunRepo, "summary_rows">;
  calls: Pick<ModelCallLog, "totals_for_run">;
  issues: Pick<IssueRepo, "current">;
  alignment: Pick<AlignmentRepo, "for_lesson">;
  // JobRow carries no version_id (NL-30 owns it), so the generated version is looked up by lesson.
  versions: GeneratedVersionReader;
  docs: Pick<LessonDocReader, "latest_derived">;
}
export interface FullRunContext {
  ports: FullRunReadPorts;
  evidence: EvidenceRepo;
  repo_root: string;
  reports_dir?: string;
  git_sha: string;
  prompt_version_id: string | null;
  models: JsonValue;
  provider_mode: ProviderMode;
  env?: Record<string, string | undefined>;
}
export interface FullRunReport {
  run_id: RunId;
  n: number;
  first_pass_schema_valid: number;
  repairs: number;
  failures_by_reason: JsonValue;
  placeholders: number;
  grounding_flags_by_kind: JsonValue;
  confirmations: number;
  cost_usd: Usd;
  report_path: string;
}
export interface ApiRunSummary {
  cost_usd: number | string;
}
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
}
export interface FullRunFacts {
  run_id: RunId;
  cap_usd: Usd;
  n: number;
  n_ready: number;
  first_pass_schema_valid: number;
  /** Lesson jobs that reached ready or failed, i.e. actually ran. A first-pass count over zero of these means nothing. */
  lessons_run: number;
  repairs: number;
  failures_by_reason: Record<string, number>;
  placeholders: number;
  grounding_flags_by_kind: Record<string, number>;
  disclosure_prompts_l31_l32: number;
  confirmations: number;
  round_trip_ok: number;
  round_trip_total: number;
  cost_usd: Usd;
  jobs_cost: Usd;
  per_lesson_max: Usd;
  wall_s: number;
  p95_minutes: number | null;
  all_terminal: boolean;
  lessons: LessonFact[];
}
export interface ThresholdResult {
  id: string;
  passed: boolean;
  detail: string;
}

export const GROUNDING_KINDS: readonly CheckKind[] = [
  "quote_unmatched", "page_out_of_range", "proper_noun_unsourced", "quote_without_source", "quote_too_long", "rights_to_clear",
];

function sorted_counts(m: Map<string, number>): Record<string, number> {
  return Object.fromEntries([...m.entries()].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));
}
function bump(m: Map<string, number>, k: string, by = 1): void {
  m.set(k, (m.get(k) ?? 0) + by);
}

export async function collect_full_run_facts(run_id: RunId, ports: FullRunReadPorts): Promise<FullRunFacts> {
  const rows = await ports.runs.summary_rows(run_id);
  const totals = await ports.calls.totals_for_run(run_id);
  const jobs = rows.jobs.filter((j) => j.kind === "lesson" && j.lesson_id !== null);
  const failures = new Map<string, number>();
  const grounding = new Map<string, number>();
  const lessons: LessonFact[] = [];
  const confirm_counts: number[] = [];
  let first_pass = 0;
  let lessons_run = 0;
  let disclosure = 0;
  let rt_ok = 0;
  let rt_total = 0;
  let all_terminal = true;
  let jobs_cost = new Decimal(0);
  let per_lesson_max = new Decimal(0);
  const minutes: number[] = [];

  for (const j of jobs) {
    const lesson_id = j.lesson_id as string;
    const ran = j.tile_state === "ready" || j.tile_state === "failed";
    if (ran) lessons_run++;
    if (ran && j.repairs === 0 && j.truncation_retries === 0 && !j.failure_reasons.some((f) => f.check === "schema_invalid")) first_pass++;
    for (const f of j.failure_reasons) bump(failures, f.check);
    jobs_cost = jobs_cost.plus(j.cost_usd);
    if (j.cost_usd.gt(per_lesson_max)) per_lesson_max = j.cost_usd;
    if (j.started_at !== null && j.finished_at !== null) minutes.push((j.finished_at.getTime() - j.started_at.getTime()) / 60000);
    const terminal_ok = (j.tile_state === "ready") || (j.tile_state === "failed" && j.failure_reasons.length >= 1);
    if (!terminal_ok) all_terminal = false;

    for (const i of (await ports.issues.current(j.lesson_id as never)).issues) {
      if (i.resolved_at !== null || i.cleared_by !== null) continue;
      if ((GROUNDING_KINDS as readonly string[]).includes(i.kind)) bump(grounding, i.kind);
      if (i.kind === "disclosure_prompt" && /\.L3[12]$/.test(lesson_id)) disclosure++;
    }

    const version = await ports.versions.generated_version(j.lesson_id as LessonId);
    let confirmations: number | null = null;
    if (version !== null) {
      const links = await ports.alignment.for_lesson(j.lesson_id as never);
      confirmations = links.filter((l) => l.content_hash === version.content_hash && l.origin !== "outline" && l.confirmed_by === null).length;
      confirm_counts.push(confirmations);
    }
    let round_trip: boolean | null = null;
    if (j.tile_state === "ready") {
      const d = version !== null ? await ports.docs.latest_derived(j.lesson_id as never) : null;
      round_trip = version !== null && d !== null && d.content_hash === version.content_hash;
      rt_total++;
      if (round_trip) rt_ok++;
    }
    lessons.push({
      lesson_id, tile_state: j.tile_state, queued_at: j.queued_at.getTime(), repairs: j.repairs, cost_usd: j.cost_usd,
      confirmations, round_trip, first_failure: j.failure_reasons[0]?.check ?? null, terminal_ok,
    });
  }
  lessons.sort((a, b) => a.queued_at - b.queued_at || (a.lesson_id < b.lesson_id ? -1 : a.lesson_id > b.lesson_id ? 1 : 0));

  confirm_counts.sort((a, b) => a - b);
  let confirmations = 0;
  if (confirm_counts.length > 0) {
    const mid = confirm_counts.length >> 1;
    confirmations = confirm_counts.length % 2 === 1 ? (confirm_counts[mid] as number) : Math.ceil(((confirm_counts[mid - 1] as number) + (confirm_counts[mid] as number)) / 2);
  }
  minutes.sort((a, b) => a - b);
  const p95_minutes = minutes.length === 0 ? null : (minutes[Math.ceil(0.95 * minutes.length) - 1] as number);
  const end = rows.run.finished_at ?? rows.run.created_at;
  return {
    run_id, cap_usd: rows.run.cap_usd, n: jobs.length, n_ready: jobs.filter((j) => j.tile_state === "ready").length,
    first_pass_schema_valid: first_pass, lessons_run, repairs: totals.repairs, failures_by_reason: sorted_counts(failures),
    placeholders: rows.placeholders_left, grounding_flags_by_kind: sorted_counts(grounding), disclosure_prompts_l31_l32: disclosure,
    confirmations, round_trip_ok: rt_ok, round_trip_total: rt_total, cost_usd: totals.cost_usd, jobs_cost, per_lesson_max,
    wall_s: (end.getTime() - rows.run.created_at.getTime()) / 1000, p95_minutes, all_terminal, lessons,
  };
}

// eval-plan.md S9 thresholds (line 195). Money compares on Decimal.
export function evaluate_s9_thresholds(facts: FullRunFacts, api_summary: ApiRunSummary | null, expected_n = 47): ThresholdResult[] {
  const rate = facts.n === 0 ? 0 : facts.first_pass_schema_valid / facts.n;
  const sums_equal = facts.jobs_cost.eq(facts.cost_usd);
  const api_equal = api_summary === null || new Decimal(api_summary.cost_usd).eq(facts.cost_usd);
  return [
    { id: "first_pass_schema_valid_rate_ge_0.90", passed: facts.n > 0 && facts.lessons_run > 0 && rate >= 0.9, detail: facts.lessons_run === 0 ? `not evaluated: 0 of ${facts.n} lessons ran` : `${facts.first_pass_schema_valid}/${facts.n} = ${rate.toFixed(3)}, ${facts.lessons_run} ran (M-31; M-5 is not computed here, the first-pass rate and repair count stand in)` },
    { id: "all_terminal_with_reasons", passed: facts.all_terminal, detail: facts.all_terminal ? "every job ready or failed with a reason" : "a job is not terminal or has no failure reason" },
    { id: "round_trip_hash_all", passed: facts.round_trip_total === facts.n_ready && facts.round_trip_ok === facts.round_trip_total && facts.n_ready > 0, detail: `${facts.round_trip_ok}/${expected_n} ready lessons match their derived hash (${facts.n_ready} ready)` },
    { id: "median_confirmations_le_4", passed: facts.confirmations <= 4, detail: `median ${facts.confirmations} (M-41)` },
    { id: "spend_le_run_cap", passed: facts.cost_usd.lte(facts.cap_usd), detail: `${facts.cost_usd.toString()} of cap ${facts.cap_usd.toString()}` },
    { id: "per_lesson_cost_le_1usd", passed: facts.per_lesson_max.lte(1), detail: `max ${facts.per_lesson_max.toString()}` },
    { id: "p95_minutes_le_5", passed: facts.p95_minutes !== null && facts.p95_minutes <= 5, detail: `p95 ${facts.p95_minutes === null ? "n/a" : facts.p95_minutes.toFixed(2)} min` },
    { id: "wall_le_2h", passed: facts.wall_s <= 7200, detail: `${Math.round(facts.wall_s)} s` },
    { id: "disclosure_prompts_l31_l32_zero", passed: facts.disclosure_prompts_l31_l32 === 0, detail: `${facts.disclosure_prompts_l31_l32} open` },
    { id: "totals_equal_call_sums", passed: sums_equal && api_equal, detail: `calls ${facts.cost_usd.toString()}, jobs ${facts.jobs_cost.toString()}${api_summary === null ? "" : `, api ${String(api_summary.cost_usd)}`}` },
    { id: "n_is_47", passed: facts.n === expected_n, detail: `n = ${facts.n}, expected ${expected_n}` },
  ];
}

export interface ReportHeader {
  git_sha: string;
  prompt_version_id: string | null;
  models: JsonValue;
  provider_mode: ProviderMode;
}

export function render_full_run_markdown(facts: FullRunFacts, thresholds: ThresholdResult[], header: ReportHeader): string {
  const kv = (o: Record<string, number>): string => (Object.keys(o).length === 0 ? "- none" : Object.entries(o).map(([k, v]) => `- ${k}: ${v}`).join("\n"));
  const rate = facts.n === 0 || facts.lessons_run === 0 ? "n/a" : (facts.first_pass_schema_valid / facts.n).toFixed(3);
  return [
    `# Full-run report: ${facts.run_id}`,
    "",
    `- git_sha: ${header.git_sha}`,
    `- prompt_version: ${header.prompt_version_id ?? "n/a"}`,
    `- models: ${JSON.stringify(header.models)}`,
    `- provider_mode: ${header.provider_mode}`,
    `- n: ${facts.n}`,
    `single run, n = ${facts.n}`,
    "",
    "## Counts",
    "| field | value |",
    "|---|---|",
    `| n | ${facts.n} |`,
    `| lessons run (ready or failed) | ${facts.lessons_run} of ${facts.n} |`,
    `| first_pass_schema_valid | ${facts.first_pass_schema_valid} (rate ${rate}) |`,
    `| repairs | ${facts.repairs} |`,
    `| placeholders | ${facts.placeholders} |`,
    `| confirmations (median) | ${facts.confirmations} |`,
    `| round trip | ${facts.round_trip_ok}/${facts.round_trip_total} |`,
    `| cost_usd | ${facts.cost_usd.toString()} |`,
    `| p95 minutes per lesson | ${facts.p95_minutes === null ? "n/a" : facts.p95_minutes.toFixed(2)} |`,
    "",
    "## failures_by_reason",
    kv(facts.failures_by_reason),
    "",
    "## grounding_flags_by_kind",
    kv(facts.grounding_flags_by_kind),
    "",
    "## Thresholds",
    "| id | result | detail |",
    "|---|---|---|",
    ...thresholds.map((t) => `| ${t.id} | ${t.passed ? "pass" : "FAIL"} | ${t.detail} |`),
    "",
    "## Lessons",
    "| lesson_id | tile_state | repairs | cost_usd | confirmations | round trip |",
    "|---|---|---|---|---|---|",
    ...facts.lessons.map((l) => `| ${l.lesson_id} | ${l.tile_state} | ${l.repairs} | ${l.cost_usd.toString()} | ${l.confirmations ?? "n/a"} | ${l.round_trip === null ? "n/a" : l.round_trip ? "ok" : "MISMATCH"} |`),
    "",
  ].join("\n");
}

export interface DetailedReport {
  report: FullRunReport;
  facts: FullRunFacts;
  thresholds: ThresholdResult[];
  eval_run_id: string;
}

export async function build_full_run_report_detailed(
  run_id: RunId, ctx: FullRunContext, api_summary: ApiRunSummary | null = null, expected_n = 47,
): Promise<DetailedReport> {
  const facts = await collect_full_run_facts(run_id, ctx.ports);
  const thresholds = evaluate_s9_thresholds(facts, api_summary, expected_n);
  const text = render_full_run_markdown(facts, thresholds, {
    git_sha: ctx.git_sha, prompt_version_id: ctx.prompt_version_id, models: ctx.models, provider_mode: ctx.provider_mode,
  });
  make_leak_guard(ctx.env ?? process.env)("full-run-report", text);
  const dir = ctx.reports_dir ?? path.join(ctx.repo_root, "evals", "reports");
  fs.mkdirSync(dir, { recursive: true });
  const abs = path.join(dir, `full-run-${run_id}.md`);
  fs.writeFileSync(abs, text);
  const report_path = path.relative(ctx.repo_root, abs).split(path.sep).join("/");

  const row = await ctx.evidence.start_eval_run({
    suite: "S9", git_sha: ctx.git_sha, prompt_version_id: ctx.prompt_version_id, models: ctx.models,
    provider_mode: ctx.provider_mode, case_set: `run=${run_id};n=${facts.n}`, run_id,
  });
  let passed = 0;
  for (const l of facts.lessons) {
    const ok = l.terminal_ok && (l.tile_state !== "ready" || l.round_trip === true);
    if (ok) passed++;
    await ctx.evidence.add_case_result({
      eval_run_id: row.eval_run_id, case_id: l.lesson_id, provenance: ctx.provider_mode === "stub" ? "synthetic" : "issued",
      source: `run:${run_id}`, guards: "S9", passed: ok, failure_category: ok ? null : (l.first_failure ?? "not_terminal"),
      expected: { terminal: true }, actual: { tile_state: l.tile_state, repairs: l.repairs, cost_usd: l.cost_usd.toString() },
    });
  }
  await ctx.evidence.finish_eval_run(row.eval_run_id, passed, facts.n, report_path);
  const report: FullRunReport = {
    run_id, n: facts.n, first_pass_schema_valid: facts.first_pass_schema_valid, repairs: facts.repairs,
    failures_by_reason: facts.failures_by_reason, placeholders: facts.placeholders,
    grounding_flags_by_kind: facts.grounding_flags_by_kind, confirmations: facts.confirmations, cost_usd: facts.cost_usd, report_path,
  };
  return { report, facts, thresholds, eval_run_id: row.eval_run_id };
}

export async function build_full_run_report(run_id: RunId, ctx: FullRunContext, api_summary: ApiRunSummary | null = null): Promise<FullRunReport> {
  return (await build_full_run_report_detailed(run_id, ctx, api_summary)).report;
}
