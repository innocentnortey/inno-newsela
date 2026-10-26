// NL-109: S3 draft golden. Runs the real worker pipeline (RunService.start -> claim loop -> draft/check/repair) for the
// three worked pairs WP-1..WP-3 on the stub provider (or, later and with Innocent's yes, the real one), one fresh test
// database per case-repeat, and scores eight pure assertions per run. Wiring only; the logic is in the s3-* modules.
import { readFileSync } from "node:fs";
import path from "node:path";
import Decimal from "decimal.js";
import type { JsonValue } from "@ls/core/ports/common";
import type { CaseOutcome, EvalCase, EvalOptions, EvalSuite, ProviderMode, SuiteReportSummary } from "../types.ts";
import { derive_trajectory, run_assertions } from "./s3-assertions.ts";
import { DRAFTS_DIR, load_s3_cases, type S3CaseEntry } from "./s3-cases.ts";
import { check_estimate, check_running, guard_limit, guard_line, REAL_MAX_OUTPUT, RETRY_MAX_OUTPUT, run_cap } from "./s3-guards.ts";
import { render_drafts_report, type S3Actual, type Sp1Baseline } from "./s3-report.ts";
import { read_draft_file, run_case, type S3RunDeps } from "./s3-run.ts";

export type S3Deps = Partial<S3RunDeps>;

function load_sp1(): Sp1Baseline | null {
  try {
    return JSON.parse(readFileSync(path.join(DRAFTS_DIR, "sp1-baseline.json"), "utf8")) as Sp1Baseline;
  } catch {
    return null;
  }
}

export function make_s3(provider_mode: ProviderMode, deps: S3Deps = {}): EvalSuite {
  const entries = load_s3_cases();
  const by_id = new Map<string, S3CaseEntry>(entries.map((e) => [e.file.case_id, e]));
  const env = deps.env ?? process.env;
  let history: { case_id: string; repeat: number; actual: S3Actual }[] = [];
  let spent = new Decimal(0);
  let last_opts: EvalOptions | null = null;

  return {
    name: "S3",
    cases: (): EvalCase[] => entries.map((e) => ({
      case_id: e.file.case_id, provenance: e.file.provenance, source: e.file.source, guards: e.file.guards,
      input_path: e.file.input_path, expected: structuredClone(e.file.expected),
    })),

    preflight(opts: EvalOptions): void {
      history = [];
      spent = new Decimal(0);
      last_opts = opts;
      if (opts.provider_mode === "stub" && opts.stub_draft) read_draft_file(opts.stub_draft); // a missing file refuses before any run
      check_estimate(opts, entries.length, opts.repeat, env);
    },

    async score(c: EvalCase, opts: EvalOptions): Promise<CaseOutcome> {
      const entry = by_id.get(c.case_id);
      if (entry === undefined) throw new Error(`unknown S3 case ${c.case_id}`);
      last_opts = opts;
      const real = opts.provider_mode === "real" || provider_mode === "real";
      const { limit } = guard_limit(opts.max_usd, env);
      if (real) check_running(spent, limit);
      const observed = await run_case(c.case_id, entry.input, opts, { env, ...deps, cap_usd: real ? run_cap(spent, limit) : 2 });
      const results = run_assertions(entry.expected, observed);
      const trajectory = derive_trajectory(observed, results);
      const cost = observed.calls.reduce((a, x) => a.plus(x.cost_usd ?? 0), new Decimal(0));
      spent = spent.plus(cost);
      const sum = (f: (x: (typeof observed.calls)[number]) => number | null): number => observed.calls.reduce((a, x) => a + (f(x) ?? 0), 0);
      const uniq = (xs: (string | null)[]): string[] => [...new Set(xs.filter((x): x is string => x !== null))].sort();
      const actual: S3Actual = {
        pair: entry.expected.pair,
        assertions: results,
        trajectory,
        counts: { placeholders: (observed.node_types["excerpt_slot"] ?? 0) + (observed.node_types["quote_placeholder"] ?? 0), minutes_total: observed.minutes_total, sections: observed.sections.length },
        schema_valid_first_pass: observed.schema_valid_first_pass,
        repairs_used: observed.repairs_used,
        tokens: { input: sum((x) => x.input_tokens), output: sum((x) => x.output_tokens) },
        served_models: uniq(observed.calls.map((x) => x.served_model)),
        requested_models: uniq(observed.calls.map((x) => x.requested_model)),
        cost_usd: cost.toString(),
        calls: observed.calls.map((x) => ({ purpose: x.purpose, attempt: x.attempt, status: x.status, stop_reason: x.stop_reason, served_model: x.served_model, input_tokens: x.input_tokens, output_tokens: x.output_tokens, cost_usd: x.cost_usd })),
      };
      history.push({ case_id: c.case_id, repeat: history.filter((h) => h.case_id === c.case_id).length + 1, actual });
      const first_fail = results.find((r) => !r.passed);
      return {
        case_id: c.case_id, passed: first_fail === undefined, failure_category: first_fail?.fc ?? null,
        actual: JSON.parse(JSON.stringify(actual)) as JsonValue, cost_usd: cost,
      };
    },

    report_text(summary: SuiteReportSummary): string | null {
      const o = last_opts;
      const g = o !== null && (o.provider_mode === "real" || o.max_usd != null) ? guard_line(entries.length, summary.repeat, guard_limit(o.max_usd, env)) : null;
      return render_drafts_report({
        git_sha: summary.git_sha, prompt_version: summary.prompt_version, provider_mode: summary.provider_mode, repeat: summary.repeat,
        cost_total: summary.cost_usd, guard_line: g, effort: "low", max_tokens: `${REAL_MAX_OUTPUT} (retry ${RETRY_MAX_OUTPUT})`, history, sp1: load_sp1(),
      });
    },
  };
}
