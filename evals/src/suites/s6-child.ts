// NL-107: the worker process the kill test SIGKILLs. Stand-in for apps/worker/src/main.ts, which does not start the claim loop
// yet (seam S-8: its db and model_client are still `unbuilt`). Real PgDatabase, real wiring, StubModelClient. SIGTERM stops it cleanly.
// Env: DATABASE_URL, FAULT_OUTLINE_VERSION_ID, FAULT_DRAFT_DELAY_MS, plus the worker settings (GENERATION_CONCURRENCY, JOB_LEASE_MS ...).
import { load_worker_settings } from "@ls/config/settings";
import { SystemClock } from "@ls/core/ports/clock";
import { PrefixedIdGenerator } from "@ls/core/ports/ids";
import { settings_for } from "@ls/db/testing/test-db";
import { PgDatabase } from "@ls/db/pool";
import { PgOutlineRepo } from "@ls/db/repos/outlines";
import { StubModelClient } from "@ls/llm/stub";
import { create_logger } from "@ls/obs/logger";
import { wire_generation } from "../../../apps/worker/src/wiring/generation.ts";
import type { WorkerDeps } from "../../../apps/worker/src/deps-types.ts";
import { make_healthy } from "./s6-drafts.ts";
import { plan_for, stub_prices } from "./s6-world.ts";

async function main(): Promise<void> {
  const env = process.env as Record<string, string>;
  const settings = load_worker_settings(env);
  const db = new PgDatabase(settings_for(env["DATABASE_URL"]!, 8), 8, 10_000, "worker");
  const clock = new SystemClock();
  const ids = new PrefixedIdGenerator();
  const rows = (await new PgOutlineRepo({ db, ids, clock }).rows(env["FAULT_OUTLINE_VERSION_ID"]!)).map((r) => r.row);
  const healthy = make_healthy(rows);
  const delay_ms = Number(env["FAULT_DRAFT_DELAY_MS"] ?? "0");
  const stub = new StubModelClient({ clock });
  stub.script("GENERATION", "unit_plan", (req) => plan_for(rows, req));
  stub.script("GENERATION", "lesson_draft", (req) => ({ kind: "delay", ms: delay_ms, then: healthy(req) }));
  stub.script("REPAIR", "lesson_draft", healthy);
  const logger = create_logger({ service: "worker", build_id: "faults", level: "info", write: (l) => void process.stdout.write(l + "\n") });
  const deps: WorkerDeps = { settings, logger, db: db as never, ids, clock, model_client: stub };
  const { claim_loop } = wire_generation(deps, { prices: stub_prices() });
  const stop = { flag: false, is_set(): boolean { return this.flag; } };
  process.on("SIGTERM", () => { stop.flag = true; });
  await claim_loop.start();
  await claim_loop.run_until(stop);
  await db.close();
}

await main();
