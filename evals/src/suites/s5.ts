// NL-125 (WF-43): the S5 integrity suite. The Playwright specs in apps/web/e2e/integrity run six invariants per trial with
// three live browser contexts and append one line per assertion per trial to a JSONL file. This suite turns those lines into
// eval_case_result rows through the shared runner: repeat k of a case reads trial k (the runner passes no repeat number, so
// the counter lives in this closure). A trial with no line is a failure (`trial_missing`), never a pass.
import path from "node:path";
import { fileURLToPath } from "node:url";
import Decimal from "decimal.js";
import type { CaseOutcome, EvalCase, EvalOptions, EvalSuite, ProviderMode } from "../types.ts";
import { make_read_trials, read_available, TOKENS, type S5Deps, type Token } from "./s5-support.ts";

export type { S5Deps };

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

const case_for = (token: Token): EvalCase => ({
  case_id: token,
  provenance: "synthetic",
  source: "DO-5 S5 / WP-1 Lesson 4 stub",
  guards: "S5",
  input_path: "n/a",
  expected: { passed: true },
});

export function make_s5(_provider_mode: ProviderMode, deps?: Partial<S5Deps>): EvalSuite {
  const read_trials = deps?.read_trials ?? make_read_trials(REPO_ROOT);
  const available = deps?.available ?? read_available(REPO_ROOT);
  const counters = new Map<string, number>();

  const cases = (): EvalCase[] => {
    const only = process.env["INTEGRITY_ONLY"];
    return TOKENS.filter((t) => (t !== "suggestion_blocks" || available.suggestion) && (only === undefined || only === "" || only === t)).map(case_for);
  };

  return {
    name: "S5",
    cases,
    async score(c: EvalCase, opts: EvalOptions): Promise<CaseOutcome> {
      const k = (counters.get(c.case_id) ?? 0) + 1;
      counters.set(c.case_id, k);
      const line = (await read_trials()).filter((l) => l.token === c.case_id && l.trial === k).at(-1);
      if (line === undefined) {
        return {
          case_id: c.case_id, passed: false, failure_category: "trial_missing",
          actual: { trial: k, n: opts.repeat, git_sha: opts.git_sha, detail: "no trial line was written" }, cost_usd: new Decimal(0),
        };
      }
      return {
        case_id: c.case_id,
        passed: line.passed,
        failure_category: line.passed ? null : "invariant_failed",
        actual: { trial: k, n: opts.repeat, store_ms: line.store_ms, detail: line.detail, git_sha: opts.git_sha },
        cost_usd: new Decimal(0),
      };
    },
  };
}
