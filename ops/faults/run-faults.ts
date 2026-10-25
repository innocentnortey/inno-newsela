// NL-107 (WF-28): entry point of the HP-7 fault-injection script: `npx tsx ops/faults/run-faults.ts [--provider stub|real]`.
// The logic lives in evals/src/suites/s6-run.ts (run_fault_suite, main) because the lint boundary rules forbid ops -> evals and
// evals -> ops imports; this shim starts it as a process and passes the arguments and the exit code through.
import { spawnSync } from "node:child_process";
import path from "node:path";

const repo_root = path.resolve(import.meta.dirname, "../..");
const run = spawnSync(process.execPath, ["--import", "tsx", path.join(repo_root, "evals/src/suites/s6-run.ts"), ...process.argv.slice(2)], { cwd: repo_root, stdio: "inherit" });
process.exitCode = run.status ?? 2;
