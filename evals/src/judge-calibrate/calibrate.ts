// NL-111 (WF-31, S12): measure whether the judge agrees with Innocent's labels. Never gates Approve, never writes
// judge_verdict, issue, lesson or lesson_version: only model_call, spend (real mode) and eval_run / eval_case_result.
import Decimal from "decimal.js";
import { ProviderError } from "@ls/core/errors";
import type { JsonValue, LessonId, ModelCallId, ModelPrice, ReservationId, Sha256, UserId, Usd } from "@ls/core/ports/common";
import type { EvidenceRepo } from "@ls/core/ports/evidence";
import type { JudgeClient, JudgeRequest, JudgeVerdictResult } from "@ls/core/ports/judge-client";
import type { LessonDocReader } from "@ls/core/ports/lesson-docs";
import type { ModelCallLog } from "@ls/core/ports/model-call-log";
import type { SpendLedger } from "@ls/core/ports/spend";
import type { StandardRepo } from "@ls/core/ports/standards";
import { max_call_cost, settle_cost } from "@ls/core/spend/reservation";
import { JUDGE_MAX_OUTPUT_TOKENS, JUDGE_RUBRIC_V1 } from "@ls/llm/openrouter-judge";
import type { PMNode } from "@ls/schema/lesson";
import { parse_labels, type LabelRow } from "./labels.ts";
import { dev_section, final_report, type Agreement, type ReportHeader, type WriteFile } from "./report.ts";

/** The label of the rubric text in the adapter (JUDGE_RUBRIC_V1). Changing the rubric or the model means a re-run. */
export const rubric_version = "judge-rubric-v1";
export const REPORT_PATH = "evals/reports/judge-calibration.md";

export class CalibrationRefused extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CalibrationRefused";
  }
}

export interface CalibrationDeps {
  labels_text: string | null; // null: the file is missing
  lessons: LessonDocReader;
  standards: StandardRepo;
  judge: JudgeClient;
  call_log: ModelCallLog;
  ledger: SpendLedger | null; // real mode only
  evidence: EvidenceRepo;
  provider_mode: "real" | "stub";
  model_id: string;
  git_sha: string;
  out_path: string;
  write_report: WriteFile;
  user_id: UserId | null; // reservations (real mode)
  cap_usd: number | null; // real mode
  price_for: (model_id: string) => ModelPrice;
}

export interface CalibrationResult { dev: Agreement; holdout: Agreement; provider_errors: number; eval_run_id: string }

interface Prepared { row: LabelRow; request: JudgeRequest }

function text_of(node: PMNode, out: string[]): void {
  if (node.text !== undefined) out.push(node.text);
  for (const child of node.content ?? []) text_of(child, out);
}

async function prepare(rows: LabelRow[], d: CalibrationDeps): Promise<Prepared[]> {
  const prepared: Prepared[] = [];
  const latest = new Map<string, Awaited<ReturnType<LessonDocReader["latest_derived"]>>>();
  for (const row of rows) {
    if (!latest.has(row.lesson_id)) latest.set(row.lesson_id, await d.lessons.latest_derived(row.lesson_id as LessonId));
    const derived = latest.get(row.lesson_id);
    if (derived === null || derived === undefined) throw new CalibrationRefused(`pair ${row.pair_id}: lesson ${row.lesson_id} is not stored`);
    // LessonDocReader has no read-by-hash (open item 1): a label made against an older version is refused, not guessed.
    if (derived.content_hash !== row.content_hash) throw new CalibrationRefused(`pair ${row.pair_id}: stale label, the lesson ${row.lesson_id} changed since it was labelled`);
    const section = derived.lesson.sections.find((s) => s.address === row.address);
    if (section === undefined) throw new CalibrationRefused(`pair ${row.pair_id}: no section at address ${row.address}`);
    const parts: string[] = [];
    text_of(section.content as PMNode, parts);
    const std = (await d.standards.texts([row.code]))[0];
    if (std === undefined) throw new CalibrationRefused(`pair ${row.pair_id}: standard ${row.code} is not seeded (run ops/seed.ts)`);
    prepared.push({
      row,
      request: {
        lesson_id: row.lesson_id as LessonId, content_hash: row.content_hash as Sha256, address: row.address, code: row.code,
        standard_text: std.text, activity_text: parts.join(" "), question: row.question, rubric_version,
      },
    });
  }
  return prepared;
}

export interface PairOutcome { verdict: "yes" | "no" | null; agree: boolean; failure_category: string | null; cost: Usd }

/** One pair through the judge as a recorded model_call. Used by the run and by the S12 suite replay. */
export async function judge_pair(req: JudgeRequest, d: Pick<CalibrationDeps, "judge" | "call_log" | "ledger" | "provider_mode" | "model_id" | "user_id" | "price_for">, label: "yes" | "no", spent: Decimal = new Decimal(0), cap_usd: number | null = null): Promise<PairOutcome> {
  let reservation_id: ReservationId | null = null;
  const price = d.provider_mode === "real" ? d.price_for(d.model_id) : null;
  if (price !== null) {
    if (d.ledger === null || d.user_id === null) throw new CalibrationRefused("real mode needs a spend ledger and a user for reservations");
    const estimate = Math.ceil((JUDGE_RUBRIC_V1.length + JSON.stringify(req).length) / 4);
    const amount = max_call_cost(price, estimate, JUDGE_MAX_OUTPUT_TOKENS);
    if (cap_usd !== null && spent.plus(amount).gt(cap_usd)) throw new CalibrationRefused("the next call could pass --cap-usd; stopping");
    const decision = await d.ledger.reserve({ run_id: null, job_id: null, user_id: d.user_id, purpose: "judge", amount_usd: amount });
    if (!decision.allowed || decision.reservation_id === null) throw new CalibrationRefused(`spend refused by ${decision.refused_by ?? "a cap"}`);
    reservation_id = decision.reservation_id;
  }
  const started = Date.now();
  try {
    const model_call_id: ModelCallId = await d.call_log.insert_sent({
      run_id: null, lesson_id: req.lesson_id, job_id: null, attempt: 1, purpose: "judge", alias: "JUDGE", requested_model: d.model_id,
      rendered_prompt: JSON.stringify({ question: req.question, standard_text: req.standard_text, activity_text: req.activity_text }),
      request_id: null, experiment_id: null, reservation_id,
    });
    let res: JudgeVerdictResult;
    try {
      res = await d.judge.verdict(req);
    } catch (e) {
      if (!(e instanceof ProviderError)) throw e;
      await d.call_log.fail(model_call_id, { kind: e.kind, http_status: e.http_status, message: e.message, retry_after_s: e.retry_after_s });
      return { verdict: null, agree: false, failure_category: "provider_error", cost: new Decimal(0) };
    }
    const cost = price !== null ? settle_cost(price, res.usage) : new Decimal(0);
    await d.call_log.complete(model_call_id, {
      raw_output: res.raw_text, stop_reason: "end_turn", usage: res.usage, cost_usd: cost, served_model: res.served_model,
      provider_request_id: res.provider_request_id, latency_ms: Date.now() - started,
    });
    if (reservation_id !== null && d.ledger !== null) await d.ledger.settle(reservation_id, cost, model_call_id);
    return { verdict: res.verdict, agree: res.verdict === label, failure_category: null, cost };
  } finally {
    if (reservation_id !== null && d.ledger !== null) await d.ledger.release(reservation_id);
  }
}

/** Step 1, before any DB write or judge call: the file exists, 20 dev and 10 holdout labels, no duplicate pair_id. */
export function check_labels(labels_text: string | null): LabelRow[] {
  if (labels_text === null) throw new CalibrationRefused("evals/judge/labels.csv is missing (NL-122); nothing was judged");
  const rows = parse_labels(labels_text);
  const dev = rows.filter((r) => r.split === "dev").length;
  const holdout = rows.filter((r) => r.split === "holdout").length;
  if (dev < 20) throw new CalibrationRefused(`need at least 20 dev labels, found ${dev}`);
  if (holdout < 10) throw new CalibrationRefused(`need at least 10 holdout labels, found ${holdout}`);
  const seen = new Set<string>();
  for (const r of rows) {
    if (seen.has(r.pair_id)) throw new CalibrationRefused(`duplicate pair_id ${r.pair_id}`);
    seen.add(r.pair_id);
  }
  return rows;
}

export async function run_calibration(d: CalibrationDeps): Promise<CalibrationResult> {
  const rows = check_labels(d.labels_text);
  const dev_rows = rows.filter((r) => r.split === "dev");
  const holdout_rows = rows.filter((r) => r.split === "holdout");
  // 2. inputs for every pair, so a missing lesson or standard fails with zero calls
  const dev = await prepare(dev_rows, d);
  const holdout = await prepare(holdout_rows, d);

  const header: ReportHeader = { git_sha: d.git_sha, judge_model: d.model_id, rubric_version, provider_mode: d.provider_mode };
  const models: JsonValue = { judge: d.model_id, rubric_version };
  const run = await d.evidence.start_eval_run({
    suite: "S12", git_sha: d.git_sha, prompt_version_id: null, models, provider_mode: d.provider_mode, case_set: "labels.csv", run_id: null,
  });
  let spent = new Decimal(0);
  let provider_errors = 0;
  let passed = 0;
  const score = async (group: Prepared[]): Promise<Agreement> => {
    let agreed = 0;
    for (const p of group) {
      const out = await judge_pair(p.request, d, p.row.label, spent, d.cap_usd);
      spent = spent.plus(out.cost);
      if (out.failure_category !== null) provider_errors++;
      if (out.agree) agreed++;
      await d.evidence.add_case_result({
        eval_run_id: run.eval_run_id, case_id: p.row.pair_id, provenance: "issued", source: `labels.csv:${p.row.pair_id}`, guards: "R-23",
        passed: out.agree, failure_category: out.failure_category, expected: p.row.label, actual: out.verdict,
      });
    }
    passed += agreed;
    return { agreed, n: group.length };
  };
  // 3. dev first; its numbers are written before any holdout pair is touched
  const dev_result = await score(dev);
  d.write_report(d.out_path, dev_section(header, dev_result));
  const holdout_result = await score(holdout);
  d.write_report(d.out_path, final_report(header, dev_result, holdout_result, provider_errors));
  await d.evidence.finish_eval_run(run.eval_run_id, passed, dev.length + holdout.length, d.out_path);
  return { dev: dev_result, holdout: holdout_result, provider_errors, eval_run_id: run.eval_run_id };
}

