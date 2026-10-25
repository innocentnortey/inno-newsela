// NL-107: the worker process the kill test SIGKILLs. It runs the real worker pieces (S-8 is closed by RT-1): PgDatabase, wire_generation,
// wire_checks, start_worker_loops and install_drain (SIGTERM drains, then exits 0). Only the model client is ours: main.ts cannot be the
// child yet because MODEL_PROVIDER_MODE=stub cannot load a scripted stub from env or a fixture (seam S-28b), so the scripted stub is built here.
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
import { wire_checks } from "../../../apps/worker/src/wiring/checks.ts";
import { create_inflight_tracker, install_drain } from "../../../apps/worker/src/drain.ts";
import { start_worker_loops } from "../../../apps/worker/src/loops.ts";
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
  const generation = wire_generation(deps, { prices: stub_prices() });
  const checks = wire_checks(deps);
  const tracker = create_inflight_tracker();
  const exit = (code: number): void => process.exit(code);
  install_drain({ tracker, close: async () => { await db.close(); }, exit, logger });
  start_worker_loops({ tracker, generation, checks, logger, settings, exit });
}

await main();
