// GEN-8: `npx tsx evals/src/full-run-main.ts <driver flags>`: the driver (evals/src/driver/main.ts) plus the report,
// built from the stored rows even when the run paused or failed after it started. Needs DATABASE_URL as well as the driver's env.
import { pathToFileURL } from "node:url";
import type { RunId } from "@ls/core/ports/common";
import { main } from "./driver/main.ts";
import { build_default_deps } from "./full-run-deps.ts";
import { build_full_run_report_detailed } from "./full-run-report.ts";

export async function run_with_report(argv: string[], env: Record<string, string | undefined>): Promise<number> {
  const flag = argv.indexOf("--provider") >= 0 ? argv[argv.indexOf("--provider") + 1] : env["MODEL_PROVIDER_MODE"];
  const mode = flag === "real" ? "real" : "stub";
  return main(argv, env, {}, async ({ run_id, result }) => {
    const d = build_default_deps(env, mode);
    try {
      const r = await build_full_run_report_detailed(run_id as RunId, d.ctx, result?.summary ?? null);
      process.stdout.write(`report=${r.report.report_path}\n`);
    } finally {
      await d.close();
    }
  });
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = await run_with_report(process.argv.slice(2), process.env);
}
