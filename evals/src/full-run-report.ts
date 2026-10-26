// NL-86 (A20): the S9 full-run report, built only from stored rows read through narrow ports. Astra slice B: each stage
// prints with its own denominator; the facts live in full-run-facts.ts.
import fs from "node:fs";
import path from "node:path";
import Decimal from "decimal.js";
import type { JsonValue, RunId, Usd } from "@ls/core/ports/common";
import type { EvidenceRepo } from "@ls/core/ports/evidence";
import { collect_full_run_facts, type FullRunFacts, type FullRunReadPorts } from "./full-run-facts.ts";
import { make_leak_guard } from "./leak-guard.ts";
import type { ProviderMode } from "./types.ts";

export { collect_full_run_facts, GROUNDING_KINDS, reason_key } from "./full-run-facts.ts";
export type { FailureRecord, FullRunFacts, FullRunReadPorts, FullRunStages, LessonFact, StageCount } from "./full-run-facts.ts";

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
export interface ThresholdResult {
  id: string;
  passed: boolean;
  detail: string;
}

// eval-plan.md S9 thresholds (line 195). Money compares on Decimal.
export function evaluate_s9_thresholds(facts: FullRunFacts, api_summary: ApiRunSummary | null, expected_n = 47): ThresholdResult[] {
  const st = facts.stages;
  const rate = facts.n === 0 ? 0 : st.initial.compiled.count / facts.n;
  const rollup_ok = facts.plan_job_cost.isZero() || facts.plan_job_cost.eq(facts.unattributed_cost);
  const mismatch_ok = facts.job_cost_mismatches.length === 0;
  const sums_equal = facts.jobs_cost.plus(facts.unattributed_cost).eq(facts.cost_usd) && rollup_ok && mismatch_ok;
  const api_equal = api_summary === null || new Decimal(api_summary.cost_usd).eq(facts.cost_usd);
  const m31 = `${st.initial.compiled.count}/${facts.n} original drafts parse and compile = ${rate.toFixed(3)} (M-31; ${st.initial.parse_valid.count}/${facts.n} parse, ${st.initial.no_output} had no output); no repair needed ${st.initial.check_clean.count}/${facts.n}; stored ready ${st.stored.ready.count}/${facts.n}; ${facts.lessons_run} ran`;
  const totals_detail = `calls ${facts.cost_usd.toString()}, lesson jobs ${facts.jobs_cost.toString()} + unit-plan call ${facts.unattributed_cost.toString()} (${facts.plan_job_cost.isZero() ? "added back here: the job row was not rolled up" : `also on its job row ${facts.plan_job_cost.toString()}`})${mismatch_ok ? "" : `; job cost differs from its calls for ${facts.job_cost_mismatches.join(", ")}`}${api_summary === null ? "" : `, api ${String(api_summary.cost_usd)}`}`;
  return [
    { id: "first_pass_schema_valid_rate_ge_0.90", passed: facts.n > 0 && facts.lessons_run > 0 && rate >= 0.9, detail: facts.lessons_run === 0 ? `not evaluated: 0 of ${facts.n} lessons ran` : m31 },
    { id: "all_terminal_with_reasons", passed: facts.all_terminal, detail: facts.all_terminal ? "every job ready or failed with a reason" : "a job is not terminal or has no failure reason" },
    { id: "round_trip_hash_all", passed: facts.round_trip_total === facts.n_ready && facts.round_trip_ok === facts.round_trip_total && facts.n_ready > 0, detail: `${facts.round_trip_ok}/${facts.n_ready} ready lessons match their derived hash (${facts.n_ready} ready)` },
    { id: "median_confirmations_le_4", passed: facts.confirmations <= 4, detail: `median ${facts.confirmations} (M-41)` },
    { id: "spend_le_run_cap", passed: facts.cost_usd.lte(facts.cap_usd), detail: `${facts.cost_usd.toString()} of cap ${facts.cap_usd.toString()}` },
    { id: "per_lesson_cost_le_1usd", passed: facts.per_lesson_max.lte(1), detail: `max ${facts.per_lesson_max.toString()}` },
    { id: "p95_minutes_le_5", passed: facts.p95_minutes !== null && facts.p95_minutes <= 5, detail: `p95 ${facts.p95_minutes === null ? "n/a" : facts.p95_minutes.toFixed(2)} min` },
    { id: "wall_le_2h", passed: facts.wall_s <= 7200, detail: `${Math.round(facts.wall_s)} s` },
    { id: "disclosure_prompts_l31_l32_zero", passed: facts.disclosure_prompts_l31_l32 === 0, detail: `${facts.disclosure_prompts_l31_l32} open` },
    { id: "totals_equal_call_sums", passed: sums_equal && api_equal, detail: totals_detail },
    { id: "n_is_47", passed: facts.n === expected_n, detail: `n = ${facts.n}, expected ${expected_n}` },
  ];
}

export interface ReportHeader {
  git_sha: string;
  prompt_version_id: string | null;
  models: JsonValue;
  provider_mode: ProviderMode;
}

const ratio = (c: { count: number; denominator: number }): string => `${c.count}/${c.denominator}`;
const kv = (o: Record<string, number>, none = "- none"): string => (Object.keys(o).length === 0 ? none : Object.entries(o).map(([k, v]) => `- ${k}: ${v}`).join("\n"));

/** The stage rows, shared by the markdown report and the read-only reconstruction command. */
export function render_stage_lines(facts: FullRunFacts): string[] {
  const s = facts.stages;
  const i = s.initial;
  const r = s.review;
  const checked_total = r.lessons_checked + r.lessons_pending;
  const blockers = r.lessons_checked === 0 && r.lessons_pending > 0
    ? `pending: ${r.lessons_pending} of ${checked_total} not yet checked`
    : `${r.lessons_with_blockers} of ${r.lessons_checked} checked lessons${r.lessons_pending > 0 ? `; pending: ${r.lessons_pending} of ${checked_total} not yet checked` : ""}`;
  const watermark = r.lessons_pending > 0 ? `incomplete: ${r.lessons_pending} lessons pending`
    : r.checked_through === null ? "no checks recorded" : `complete through ${new Date(r.checked_through).toISOString()}`;
  const o = s.open_slots;
  return [
    "| stage | value | what it measures |",
    "|---|---|---|",
    `| initial draft parses (schema-valid) | ${ratio(i.parse_valid)} | the ORIGINAL draft output validated as LessonDraft |`,
    `| initial draft compiles | ${ratio(i.compiled)} | and compile_draft accepts it (M-31) |`,
    `| initial draft had no output | ${i.no_output} | counted in neither row above |`,
    `| no repair needed (recorded; checks were not re-run) | ${ratio(i.check_clean)} (${i.check_clean.count}/${i.compiled.count} of compiled) | initial draft compiled, zero repairs, zero truncation retries, ended ready |`,
    `| repairs attempted | ${s.repair.attempted} | lesson jobs with at least one repair |`,
    `| repair recovered to ready | ${ratio(s.repair.recovered)} | |`,
    `| repair output parses and compiles | ${ratio(s.repair.output_compiled)} | |`,
    `| stored ready | ${ratio(s.stored.ready)} | |`,
    `| stored failed | ${ratio(s.stored.failed)} | |`,
    `| review blockers (ready lessons) | ${blockers} | open blocking issues at each run version |`,
    `| open content slots | ${o.total} (${o.quote_placeholder} quote_placeholder, ${o.excerpt_slot} excerpt_slot) in ${o.lessons_with_slots} lessons | counted in the stored lesson content, independent of issues |`,
    `| checks watermark | ${watermark} | |`,
  ];
}

export function render_failure_lines(facts: FullRunFacts): string[] {
  const i = facts.stages.initial;
  return [
    "## Initial draft failures",
    `- unparseable: ${i.unparseable}`,
    `- schema_invalid: ${i.schema_invalid}`,
    `- compile_error: ${i.compile_error}`,
    "- invalid issue paths (counts of zod issues, index segments dropped):",
    kv(i.invalid_issue_paths, "  - none"),
    "",
    "## failures_by_reason",
    kv(facts.failures_by_reason),
    "",
    "## failures_first_by_reason",
    kv(facts.failures_first_by_reason),
    "",
    "## Failure chronology",
    "stored reasons keep the first failing check kind per lesson",
    "| order | lesson_id | finished_at | reasons |",
    "|---|---|---|---|",
    ...facts.failure_chronology.map((f, n) => `| ${n + 1} | ${f.lesson_id} | ${f.finished_at === null ? "n/a" : new Date(f.finished_at).toISOString()} | ${f.reasons.join(" > ") || "none"} |`),
  ];
}

export function render_full_run_markdown(facts: FullRunFacts, thresholds: ThresholdResult[], header: ReportHeader): string {
  const pending = facts.stages.review.lessons_pending;
  return [
    `# Full-run report: ${facts.run_id}`,
    "",
    `- git_sha: ${header.git_sha}`,
    `- prompt_version: ${header.prompt_version_id ?? facts.prompt_version_id ?? "n/a"}`,
    `- models: ${facts.models_used.length > 0 ? facts.models_used.map((m) => `${m.purpose}=${m.requested}${m.served !== null && m.served !== m.requested ? ` (served ${m.served})` : ""}`).join(", ") : JSON.stringify(header.models)}`,
    `- provider_mode: ${header.provider_mode}`,
    `- n: ${facts.n}`,
    `single run, n = ${facts.n}`,
    "",
    "## Stages (each row is count/denominator)",
    ...render_stage_lines(facts),
    "",
    "## Counts",
    "| field | value |",
    "|---|---|",
    `| n | ${facts.n} |`,
    `| lessons run (ready or failed) | ${facts.lessons_run} of ${facts.n} |`,
    `| repairs | ${facts.repairs} |`,
    `| confirmations (median) | ${facts.confirmations} |`,
    `| round trip | ${facts.round_trip_ok}/${facts.round_trip_total} |`,
    `| cost_usd | ${facts.cost_usd.toString()} |`,
    `| p95 minutes per lesson | ${facts.p95_minutes === null ? "n/a" : facts.p95_minutes.toFixed(2)} |`,
    "",
    ...render_failure_lines(facts),
    "",
    "## grounding_flags_by_kind",
    ...(pending > 0 ? [`pending: ${pending} ready lessons not yet checked; counts below are partial`] : []),
    kv(facts.grounding_flags_by_kind, pending > 0 ? "- none yet" : "- none"),
    "",
    "## Thresholds",
    "| id | result | detail |",
    "|---|---|---|",
    ...thresholds.map((t) => `| ${t.id} | ${t.passed ? "pass" : "FAIL"} | ${t.detail} |`),
    "",
    "## Lessons",
    "| lesson_id | tile_state | initial draft | repairs | cost_usd | confirmations | round trip | reasons |",
    "|---|---|---|---|---|---|---|---|",
    ...facts.lessons.map((l) => `| ${l.lesson_id} | ${l.tile_state} | ${l.initial_stage} | ${l.repairs} | ${l.cost_usd.toString()} | ${l.confirmations ?? "n/a"} | ${l.round_trip === null ? "n/a" : l.round_trip ? "ok" : "MISMATCH"} | ${l.reasons.join(" > ") || "none"} |`),
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
