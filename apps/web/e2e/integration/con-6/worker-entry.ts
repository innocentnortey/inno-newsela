// NL-96: the scripted stand-in worker process for the integration specs. Run by `npx tsx` from the repo root.
// The real worker (apps/worker/src/main.ts) builds an unscripted StubModelClient; the specs need per-test replies and gates,
// so this process wires the same generation and check loops over a scripted stub. No provider key is read or needed.
import { appendFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { load_worker_settings } from "@ls/config/settings";
import { SystemClock } from "@ls/core/ports/clock";
import { PrefixedIdGenerator } from "@ls/core/ports/ids";
import { PgDatabase } from "@ls/db/pool";
import { StubModelClient } from "@ls/llm/stub";
import { create_logger } from "@ls/obs/logger";
import { wire_checks } from "../../../../worker/src/wiring/checks.ts";
import { wire_generation } from "../../../../worker/src/wiring/generation.ts";
import { lesson_of, outline_rows, stub_prices } from "./fixtures/common";

const gate_dir = process.env.CON6_GATE_DIR ?? "";
const seen = new Map<string, number>();
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main(): Promise<void> {
  const settings = load_worker_settings(process.env);
  const logger = create_logger({ service: "worker", build_id: "con6", level: "info", write: (l) => process.stdout.write(`${l}\n`) });
  const clock = new SystemClock();
  const db = new PgDatabase(settings.shared, 12, 10_000, "worker");
  const stub = new StubModelClient({
    clock,
    on_enter: async (req) => {
      const lesson = req.output_schema_name === "UnitPlanDraft" ? "plan" : lesson_of(req) || "unknown";
      const n = (seen.get(lesson) ?? 0) + 1;
      seen.set(lesson, n);
      appendFileSync(join(gate_dir, "calls.jsonl"), `${JSON.stringify({ ts: Date.now(), schema: req.output_schema_name, lesson, n })}\n`);
      // hold-<lesson> holds every call for that lesson; hold-<lesson>-<n> holds only its n-th call (1-based).
      while (existsSync(join(gate_dir, `hold-${lesson}`)) || existsSync(join(gate_dir, `hold-${lesson}-${n}`))) await sleep(25);
    },
  });
  const mod = (await import(`./fixtures/${process.env.CON6_SCRIPT ?? "script-a"}.ts`)) as { apply(s: StubModelClient, rows: ReturnType<typeof outline_rows>): void };
  mod.apply(stub, outline_rows());
  const deps = { settings, logger, db: db as never, ids: new PrefixedIdGenerator(), clock, model_client: stub };
  const generation = wire_generation(deps, { prices: stub_prices() as never });
  const checks = wire_checks(deps);
  let stopped = false;
  const stop = { is_set: () => stopped };
  process.on("SIGTERM", () => {
    stopped = true;
  });
  const report = await generation.claim_loop.start();
  logger.info("con6.worker.started", { extra: { ...report } });
  await Promise.all([generation.claim_loop.run_until(stop), checks.check_lane.run_until(stop)]);
  await db.close().catch(() => undefined);
  process.exit(0);
}
main().catch((e: unknown) => {
  process.stderr.write(`con6 worker failed: ${e instanceof Error ? e.name : "unknown"}\n`);
  process.exit(1);
});
