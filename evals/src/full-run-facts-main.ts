// Astra slice B: read-only reconstruction. `DATABASE_URL=<db> npx tsx evals/src/full-run-facts-main.ts <run_id>` prints the
// stage facts for one stored run. SELECTs only: it writes no evidence row and no file, and never builds a report.
import { pathToFileURL } from "node:url";
import type { RunId } from "@ls/core/ports/common";
import { build_default_deps } from "./full-run-deps.ts";
import { collect_full_run_facts } from "./full-run-facts.ts";
import { render_failure_lines, render_stage_lines } from "./full-run-report.ts";

export async function reconstruct(argv: string[], env: Record<string, string | undefined>, out: (s: string) => void = (s) => process.stdout.write(s)): Promise<number> {
  const run_id = argv[0];
  if (run_id === undefined || run_id === "" || !env["DATABASE_URL"]) {
    process.stderr.write("usage: DATABASE_URL=<url> npx tsx evals/src/full-run-facts-main.ts <run_id>\n");
    return 2;
  }
  const d = build_default_deps(env, "stub");
  try {
    const f = await collect_full_run_facts(run_id as RunId, d.ctx.ports);
    const totals = `calls ${f.cost_usd.toString()}; lesson jobs ${f.jobs_cost.toString()} + unit-plan call ${f.unattributed_cost.toString()}; plan_job_cost ${f.plan_job_cost.toString()}; job cost mismatches ${f.job_cost_mismatches.length}`;
    out([`# Reconstruction: ${f.run_id}`, `n = ${f.n}; lessons run ${f.lessons_run}; repairs (lesson jobs) ${f.repairs}`, "", "## Stages", ...render_stage_lines(f), "", ...render_failure_lines(f), "", "## Totals", totals, ""].join("\n"));
    return 0;
  } finally {
    await d.close();
  }
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = await reconstruct(process.argv.slice(2), process.env);
}
