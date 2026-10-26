import type { Logger } from "@ls/obs/logger";
import type { WorkerSettings } from "@ls/config/settings";
import { SystemClock } from "@ls/core/ports/clock";
import { PrefixedIdGenerator } from "@ls/core/ports/ids";
import { PgDatabase } from "@ls/db/pool";
import { build_model_client } from "@ls/llm/provider";
import type { StubModelClient } from "@ls/llm/stub";
import type { WorkerDeps } from "./deps-types.ts";
import { is_demo_stub, script_demo_stub } from "./wiring/demo-stub.ts";

export function build_worker_deps(settings: WorkerSettings, logger: Logger): WorkerDeps {
  const clock = new SystemClock();
  const model_client = build_model_client(settings.model, clock);
  // Stub mode only (S-28b): ship a built-in script so a Compose demo can plan and draft. Real mode is untouched.
  if (is_demo_stub({ settings, model_client })) script_demo_stub(model_client as StubModelClient);
  return {
    settings,
    logger,
    // 2000 ms acquire timeout mirrors open_health_db; the pool connects lazily.
    db: new PgDatabase(settings.shared, settings.shared.pg_pool_max, 2000, "worker"),
    ids: new PrefixedIdGenerator(),
    clock,
    model_client,
  };
}
