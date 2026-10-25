// NL-92: scores each plant from stored rows after the review, writes one eval_case_result per plant and the report.
import { promises as fs } from "node:fs";
import path from "node:path";
import { InvariantViolation } from "@ls/core/errors";
import { make_leak_guard } from "../leak-guard.ts";
import { s10_floor_met, verdict, type S10Verdict } from "../suites/s10-verdict.ts";
import { make_s10, seed_case_id } from "../suites/s10.ts";
import type { EvalOptions } from "../types.ts";
import { SeedSql, type SeedDeps } from "./deps.ts";
import { KIND_CHECKS, naming_hints, planted_in } from "./mutations.ts";
import { state_path, type SeedState } from "./plant.ts";

export interface PlantResult {
  n: number;
  kind: string;
  caught: boolean;
  how: "check" | "reviewer" | "missed";
}

export async function read_state(repo_root: string, run_id: string): Promise<SeedState> {
  if (!/^[A-Za-z0-9_]+$/.test(run_id)) throw new InvariantViolation("run id has an invalid shape");
  const raw = await fs.readFile(state_path(repo_root, run_id), "utf8").catch(() => null);
  if (raw === null) throw new InvariantViolation("no planted run with that id");
  return JSON.parse(raw) as SeedState;
}

export async function score_plants(deps: SeedDeps, state: SeedState): Promise<PlantResult[]> {
  const sql = new SeedSql(deps);
  const out: PlantResult[] = [];
  for (const [i, p] of state.plants.entries()) {
    const kinds = await sql.issue_kinds(p.lesson_id, p.content_hash);
    const by_check = KIND_CHECKS[p.kind].some((k) => kinds.includes(k));
    const later = await sql.later_versions(p.lesson_id);
    const edited_out = later.some((l) => !planted_in(l, p));
    const names = naming_hints(p);
    const sent_back = (await sql.send_back_notes(p.lesson_id)).some((note) => names.some((s) => note.toLowerCase().includes(s)));
    const how = by_check ? "check" : edited_out || sent_back ? "reviewer" : "missed";
    out.push({ n: i + 1, kind: p.kind, caught: how !== "missed", how });
  }
  return out;
}

export function render_seeded_report(state: SeedState, git_sha: string, results: PlantResult[], v: S10Verdict): string {
  return [
    `# Seeded-error report: ${state.eval_run_id} @ ${git_sha}`,
    "",
    "Reviewers: our reviewers (the builder and his reviewers; not a general reviewer population).",
    `- git_sha: ${git_sha}`,
    `- eval_run_id: ${state.eval_run_id}`,
    `- key: ${state.key_id}`,
    `- n: ${v.n}`,
    `- caught before approval: ${v.caught}/${v.n} (${(v.rate * 100).toFixed(0)}%)`,
    `- verdict: ${v.status}`,
    "",
    "| plant | kind | caught before approval | by |",
    "|---|---|---|---|",
    ...results.map((r) => `| ${seed_case_id(r.n)} | ${r.kind} | ${r.caught ? "yes" : "no"} | ${r.how === "missed" ? "missed" : r.how === "check" ? "check" : "our reviewers"} |`),
    "",
  ].join("\n");
}

// `eval:seed --score <run_id>`: exit 0 floors met, 1 verdict is a fail.
export async function run_score(deps: SeedDeps, run_id: string, out: (l: string) => void): Promise<number> {
  const state = await read_state(deps.repo_root, run_id);
  const guard = make_leak_guard(deps.env);
  let memo: Promise<PlantResult[]> | null = null;
  const scored = (): Promise<PlantResult[]> => (memo ??= score_plants(deps, state));
  const suite = make_s10("stub", { key_id: state.key_id, plants: state.plants, score: scored });
  const opts: EvalOptions = { repeat: 1, provider_mode: "stub", git_sha: deps.git_sha, unit: null };
  for (const c of suite.cases()) {
    const o = await suite.score(c, opts);
    guard(`case:${c.case_id}`, c.expected);
    guard(`case:${c.case_id}`, o.actual);
    await deps.evidence.add_case_result({
      eval_run_id: state.eval_run_id, case_id: c.case_id, provenance: c.provenance, source: c.source, guards: c.guards,
      passed: o.passed, failure_category: o.failure_category, expected: c.expected, actual: o.actual,
    });
  }
  const results = await scored();
  const v = verdict(results);
  const text = render_seeded_report(state, deps.git_sha, results, v);
  guard("report", text);
  const rel = `evals/reports/seeded-${state.eval_run_id}.md`;
  await fs.mkdir(path.join(deps.repo_root, "evals/reports"), { recursive: true });
  await fs.writeFile(path.join(deps.repo_root, rel), text, "utf8");
  await deps.evidence.finish_eval_run(state.eval_run_id, v.caught, v.n, rel);
  out(`S10 ${v.caught}/${v.n} ${v.status} report=${rel}`);
  const wrong = results.filter((r) => r.kind === "wrong_standard_code");
  return s10_floor_met(v.caught, v.n, wrong.length > 0 && wrong.every((r) => r.caught)) ? 0 : 1;
}
