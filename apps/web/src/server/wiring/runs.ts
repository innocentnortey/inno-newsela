// RunWiring (NL-78): the real RunService over the Pg repositories. Building the repos never touches d.db.
import { PgAuditLog } from "@ls/db/repos/audit";
import { PgJobQueue } from "@ls/db/repos/job-queue";
import { PgLessonRepo } from "@ls/db/repos/lessons";
import { PgModelCallLog } from "@ls/db/repos/model-calls";
import { PgOutlineRepo } from "@ls/db/repos/outlines";
import { PgPromptRepo } from "@ls/db/repos/prompts";
import { PgRunProgressReader } from "@ls/db/repos/run-progress";
import { PgRunRepo } from "@ls/db/repos/runs";
import { PgSpendLedger } from "@ls/db/repos/spend";
import type { WebDeps } from "../deps.ts";
import { RunService } from "../services/run-service.ts";

export interface RunWiring {
  runs: RunService;
}

// GENERATION_CONCURRENCY is a worker setting that web settings do not carry (NL-78 R4): default and max 6.
function concurrency_cap_from_env(): number {
  const n = Number(process.env["GENERATION_CONCURRENCY"]);
  return Number.isInteger(n) && n >= 1 && n <= 6 ? n : 6;
}

// `hooks.notify` replaces the pg_notify wake-up (tests count it).
export function wire_runs(d: WebDeps, hooks: { notify?: (run_id: string) => Promise<void> } = {}): RunWiring {
  const shared = { db: d.db, ids: d.ids, clock: d.clock };
  const runs = new PgRunRepo(shared, { idempotency_window_h: d.settings.idempotency_window_h });
  // Post-commit wake-up for workers; they also poll, so a lost notify only delays pickup.
  const notify =
    hooks.notify ??
    ((run_id: string): Promise<void> =>
      d.db.with_tx(async (tx) => {
        await tx.query("SELECT pg_notify('lesson_job', $1)", [run_id]);
      }));
  return {
    runs: new RunService(
      runs, new PgJobQueue(shared), new PgOutlineRepo(shared), new PgLessonRepo(shared), new PgPromptRepo(shared),
      new PgSpendLedger({ ...shared, settings: d.settings.spend, logger: d.logger }), new PgModelCallLog(shared), new PgAuditLog(shared),
      d.db, d.ids, d.clock, d.settings, { progress: new PgRunProgressReader(shared), concurrency_cap: concurrency_cap_from_env(), notify },
    ),
  };
}
