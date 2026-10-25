// NL-49: runs one named suite, stores one eval_case_result per case, writes the report.
import { promises as fs } from "node:fs";
import path from "node:path";
import { InvariantViolation } from "@ls/core/errors";
import type { Clock } from "@ls/core/ports/clock";
import type { JsonValue, Usd } from "@ls/core/ports/common";
import type { EvidenceRepo } from "@ls/core/ports/evidence";
import { EmptySuiteError } from "./errors.ts";
import { make_leak_guard } from "./leak-guard.ts";
import { merge_section, REPORT_KIND, report_file_name, type SectionInput } from "./report.ts";
import type { EvalOptions, EvalRunSummary, EvalSuite, SuiteName } from "./types.ts";

export interface RunnerConfig {
  repo_root: string;
  reports_dir?: string;
  prompt_version_id: string | null;
  models: JsonValue;
  env?: Record<string, string | undefined>;
}

export class EvalRunner {
  private readonly guard: (where: string, value: unknown) => void;

  // `_clock` is held for the DO-4 constructor shape; reports carry no wall-clock time.
  constructor(
    private readonly evidence: EvidenceRepo,
    private readonly suites: readonly EvalSuite[],
    private readonly _clock: Clock,
    private readonly config: RunnerConfig,
  ) {
    this.guard = make_leak_guard(config.env ?? process.env);
  }

  async run(suite: SuiteName, opts: EvalOptions): Promise<EvalRunSummary> {
    const s = this.suites.find((x) => x.name === suite);
    if (s === undefined) throw new InvariantViolation("suite not registered", { suite });
    const cases = s.cases();
    if (cases.length === 0) throw new EmptySuiteError(suite); // before any evidence call
    if (!Number.isInteger(opts.repeat) || opts.repeat < 1) throw new InvariantViolation("repeat must be a positive integer", { repeat: opts.repeat });

    const row = await this.evidence.start_eval_run({
      suite, git_sha: opts.git_sha, prompt_version_id: this.config.prompt_version_id, models: this.config.models,
      provider_mode: opts.provider_mode, case_set: `cases=${cases.length};repeat=${opts.repeat}`, run_id: null,
    });
    const rows: SectionInput["rows"] = [];
    let cost: Usd | null = null;
    for (const c of cases) {
      for (let rep = 1; rep <= opts.repeat; rep++) {
        const outcome = await s.score(c, opts);
        if (outcome.case_id !== c.case_id) throw new InvariantViolation("outcome case_id mismatch", { case_id: c.case_id });
        const case_id = opts.repeat === 1 ? c.case_id : `${c.case_id}#${rep}`;
        this.guard(`case:${case_id}`, c.expected);
        this.guard(`case:${case_id}`, outcome.actual);
        await this.evidence.add_case_result({
          eval_run_id: row.eval_run_id, case_id, provenance: c.provenance, source: c.source, guards: c.guards,
          passed: outcome.passed, failure_category: outcome.failure_category, expected: c.expected, actual: outcome.actual,
        });
        rows.push({ case_id, passed: outcome.passed, source: c.source, failure_category: outcome.failure_category });
        cost = cost === null ? outcome.cost_usd : cost.plus(outcome.cost_usd);
      }
    }
    const passed = rows.filter((r) => r.passed).length;
    const total = rows.length;
    const total_cost = cost as Usd;

    const kind = REPORT_KIND[suite];
    const dir = this.config.reports_dir ?? path.join(this.config.repo_root, suite === "S11" ? "evals/local/reports" : "evals/reports");
    const abs = path.join(dir, report_file_name(suite, opts.git_sha));
    const existing = await fs.readFile(abs, "utf8").catch(() => null);
    const text = merge_section(existing, opts.git_sha, kind, {
      suite, eval_run_id: row.eval_run_id, git_sha: opts.git_sha, prompt_version: this.config.prompt_version_id,
      models: this.config.models, provider_mode: opts.provider_mode, n: total, repeat: opts.repeat, passed, total,
      cost_usd: total_cost.toString(), rows,
    });
    this.guard("report", text);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(abs, text, "utf8");
    const report_path = path.relative(this.config.repo_root, abs).split(path.sep).join("/");

    await this.evidence.finish_eval_run(row.eval_run_id, passed, total, report_path);
    return { eval_run_id: row.eval_run_id, suite, passed, total, report_path, cost_usd: total_cost };
  }
}
