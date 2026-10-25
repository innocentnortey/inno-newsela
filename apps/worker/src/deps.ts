// NL-12 re-points the types; the Pg pool arrives with NL-12/NL-83. No pg, model SDK or @ls/llm here.
import type { Logger } from "@ls/obs/logger";
import type { WorkerSettings } from "@ls/config/settings";
import type { WorkerDeps } from "./deps-types.ts";

export function build_worker_deps(settings: WorkerSettings, logger: Logger): WorkerDeps {
  let n = 0;
  return {
    settings,
    logger,
    db: { kind: "unwired" },
    ids: { next: (prefix) => `${prefix}_${(n += 1)}` },
    clock: { now: () => new Date() },
    model_client: { kind: "unwired" },
  };
}
