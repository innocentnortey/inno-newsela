// NL-103: drives the worker's real claim loop (wire_generation) against the stack database on the scripted StubModelClient.
// Stand-in for the worker process, which cannot take per-test scripted replies (S-28b). One JSON line on stdout; exit 0 only when finished.
//   parent <runId>                 generation run, all replies good
//   run <runId> [delayMs]          same, the L4 reply held for delayMs (the pin test keeps the run going)
//   trial <startedByUserId> [delayMs]   waits for a trial run started by that user, drains its jobs
//   trial-pinned <runId>           drains the jobs of one trial run started by a direct API call
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { load_worker_settings } from "@ls/config/settings";
import { SystemClock } from "@ls/core/ports/clock";
import { PrefixedIdGenerator } from "@ls/core/ports/ids";
import { PgDatabase } from "@ls/db/pool";
import { PgOutlineRepo } from "@ls/db/repos/outlines";
import { StubModelClient, type StubScriptItem } from "@ls/llm/stub";
import { create_logger } from "@ls/obs/logger";
import { lesson_of, load_fixture, plan_for, stub_prices, text } from "../../../../worker/test/support/world.ts";
import type { WorkerDeps } from "../../../../worker/src/deps-types.ts";
import { wire_generation } from "../../../../worker/src/wiring/generation.ts";
import type { StopSignal } from "../../../../worker/src/queue/claim-loop.ts";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const wp1 = load_fixture("wp-1.json");
const wp2 = load_fixture("wp-2.json");
const candidateText = (JSON.parse(readFileSync(resolve(process.cwd(), "e2e/integration/con-24/fixtures/wp1-candidate.json"), "utf8")) as { sample_response_text: string }).sample_response_text;

interface Block { role: string; text: string }
/** wp-1's draft with its first sample_response replaced. */
function withSampleResponse(replacement: string): unknown {
  const d = JSON.parse(JSON.stringify(wp1.draft)) as { blocks: Block[] };
  const b = d.blocks.find((x) => x.role === "sample_response");
  if (!b) throw new Error("wp-1 draft has no sample_response block");
  b.text = replacement;
  return d;
}

async function main(): Promise<void> {
  const [mode, arg, delayArg] = process.argv.slice(2) as [string, string, string | undefined];
  const delay_ms = Number(delayArg ?? 0);
  const env = { DATABASE_URL: process.env["DATABASE_URL"] as string, AUDIT_HASH_SALT: "s", COLLAB_INTERNAL_TOKEN: "t", MODEL_PROVIDER_MODE: "stub", GENERATION_CONCURRENCY: "1", JOB_POLL_MS: "20" };
  const settings = load_worker_settings(env);
  const clock = new SystemClock();
  const db = new PgDatabase(settings.shared, 4, 10_000, "worker");
  const logger = create_logger({ service: "worker", build_id: "con-24", level: "info", write: (l) => void process.stderr.write(l + "\n") });
  const stub = new StubModelClient({ clock });
  const deps: WorkerDeps = { settings, logger, db: db as never, ids: new PrefixedIdGenerator(), clock, model_client: stub };
  const q = async <T,>(sql: string, p: unknown[]): Promise<T[]> => db.with_tx(async (tx) => (await tx.query<T & Record<string, unknown>>(sql, p)).rows as T[]);
  const generation = mode === "parent" || mode === "run";

  if (generation) {
    const ov = (await q<{ outline_version_id: string }>("select outline_version_id from run where id=$1", [arg]))[0]!.outline_version_id;
    const rows = (await new PgOutlineRepo({ db, ids: deps.ids, clock }).rows(ov)).map((r) => r.row);
    stub.script("GENERATION", "unit_plan", (req) => plan_for(rows, req));
  }
  const held = (v: unknown): StubScriptItem => (delay_ms > 0 ? { kind: "delay", ms: delay_ms, then: text(v) } : text(v));
  stub.script("GENERATION", "lesson_draft", (req) => {
    const id = lesson_of(req);
    if (generation) return mode === "run" ? held(id === "G6.U4.L4" ? wp1.draft : wp2.draft) : text(id === "G6.U4.L4" ? wp1.draft : wp2.draft);
    return held(withSampleResponse(candidateText));
  });
  stub.script("REPAIR", "lesson_draft", (req) => text(generation ? (lesson_of(req) === "G6.U4.L4" ? wp1.draft : wp2.draft) : withSampleResponse(candidateText)));

  const wiring = wire_generation(deps, { prices: stub_prices() });
  const trialRuns = async (): Promise<string[]> =>
    mode === "trial" ? (await q<{ id: string }>("select id from run where kind='trial' and started_by=$1", [arg])).map((r) => r.id) : [arg];
  const finished = async (): Promise<boolean> => {
    if (mode === "parent") {
      const r = await q<{ state: string }>("select state from run where id=$1", [arg]);
      return r[0] !== undefined && !["planning", "running", "queued"].includes(r[0].state);
    }
    const ids = await trialRuns();
    if (ids.length === 0) return false;
    const jobs = await q<{ status: string }>("select status from lesson_job where run_id = any($1)", [ids]);
    if (mode === "run") {
      const r = await q<{ state: string }>("select state from run where id=$1", [arg]);
      if (r[0] === undefined || ["planning", "running", "queued"].includes(r[0].state)) return false;
    }
    return jobs.length > 0 && jobs.every((j) => !["queued", "running"].includes(j.status));
  };
  const stop: StopSignal & { flag: boolean } = { flag: false, is_set() { return this.flag; } };
  const exit = wiring.claim_loop.run_until(stop);
  const end = Date.now() + 120_000;
  let ok = false;
  while (Date.now() < end) {
    if (await finished()) { ok = true; break; }
    await sleep(25);
  }
  if (!ok) {
    const jobs = await q("select id, run_id, kind, status, attempt, failure_reasons_json, brakes_fired from lesson_job where run_id = any($1)", [await trialRuns()]);
    console.error("driver timeout", JSON.stringify({ jobs }));
  }
  stop.flag = true;
  await exit;
  await db.close().catch(() => undefined);
  console.log(JSON.stringify({ mode, arg, finished: ok }));
  process.exit(ok ? 0 : 1);
}
void main().catch((e) => { console.error(e instanceof Error ? e.stack : e); process.exit(2); });
