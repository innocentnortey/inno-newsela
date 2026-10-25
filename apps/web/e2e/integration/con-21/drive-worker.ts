// NL-97: drive the worker's real claim loop (wire_generation) against the stack database on the scripted StubModelClient.
// Stand-in for the worker process, which cannot take per-test scripted replies (S-8 path stays open). Run as a child:
//   DATABASE_URL=... npx tsx e2e/integration/con-21/drive-worker.ts <scenario> <runId>
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { load_worker_settings } from "@ls/config/settings";
import { SystemClock } from "@ls/core/ports/clock";
import { PrefixedIdGenerator } from "@ls/core/ports/ids";
import { PgDatabase } from "@ls/db/pool";
import { derive_run_state } from "@ls/core/lifecycle/run-machine";
import { PgJobQueue } from "@ls/db/repos/job-queue";
import { PgModelCallLog } from "@ls/db/repos/model-calls";
import { PgOutlineRepo } from "@ls/db/repos/outlines";
import { PgRunRepo } from "@ls/db/repos/runs";
import { PgSpendLedger } from "@ls/db/repos/spend";
import { RunFinalizer } from "../../../../worker/src/generation/run-finalizer.ts";
import { StubModelClient, type StubScriptItem } from "@ls/llm/stub";
import { create_logger } from "@ls/obs/logger";
import { lesson_of, load_fixture, plan_for, stub_prices, text } from "../../../../worker/test/support/world.ts";
import type { WorkerDeps } from "../../../../worker/src/deps-types.ts";
import { wire_generation } from "../../../../worker/src/wiring/generation.ts";
import type { StopSignal } from "../../../../worker/src/queue/claim-loop.ts";

type Behaviour = "repair" | "lost_repair" | "truncate" | "fail";
interface Scenario { name: string; rows: number[]; lessons: Record<string, Behaviour>; canary_prefix: string; lease_ms?: number; markup?: string }

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const wp1 = load_fixture("wp-1.json");
const wp2 = load_fixture("wp-2.json");

function stopper(): StopSignal & { flag: boolean } {
  return { flag: false, is_set() { return this.flag; } };
}

/** `completeness <runId>`: the finalizer's own check on the finished run, then with one completed call row removed, then restored. */
async function completeness_probe(run_id: string): Promise<void> {
  const settings = load_worker_settings({ DATABASE_URL: process.env["DATABASE_URL"] as string, AUDIT_HASH_SALT: "s", COLLAB_INTERNAL_TOKEN: "t", MODEL_PROVIDER_MODE: "stub" });
  const clock = new SystemClock();
  const db = new PgDatabase(settings.shared, 4, 10_000, "worker");
  const logger = create_logger({ service: "worker", build_id: "con-21", level: "info", write: () => undefined });
  const base = { db, ids: new PrefixedIdGenerator(), clock };
  const finalizer = new RunFinalizer(new PgRunRepo(base), new PgJobQueue(base), new PgModelCallLog(base), new PgSpendLedger({ ...base, settings: settings.spend, logger }), db, settings, derive_run_state, logger);
  const q = async <T,>(sql: string, p: unknown[]): Promise<T[]> => db.with_tx(async (tx) => (await tx.query<T & Record<string, unknown>>(sql, p)).rows as T[]);
  const before = await finalizer.completeness(run_id as never);
  const [victim] = await q<{ id: string; j: string }>("select id, row_to_json(m)::text j from model_call m where run_id=$1 and status='completed' and purpose='lesson_draft' order by sent_at limit 1", [run_id]);
  let removed: unknown = null;
  let restored: unknown = null;
  // Only the call row goes: the ledger keeps the settled spend, so the call total and the ledger disagree. If a foreign key
  // blocks the delete, the reservation's link to the call is cleared for the moment and put back with the row.
  const links = await q<{ id: string }>("select id from spend_reservation where model_call_id=$1", [victim!.id]);
  try {
    await q("update spend_reservation set model_call_id=null where model_call_id=$1", [victim!.id]);
    await q("delete from model_call where id=$1", [victim!.id]);
    removed = await finalizer.completeness(run_id as never);
  } finally {
    await q("insert into model_call select * from json_populate_record(null::model_call, $1::json)", [victim!.j]);
    for (const l of links) await q("update spend_reservation set model_call_id=$1 where id=$2", [victim!.id, l.id]);
    restored = await finalizer.completeness(run_id as never);
  }
  await db.close().catch(() => undefined);
  console.log(JSON.stringify({ before, removed, restored }));
}

async function main(): Promise<void> {
  if (process.argv[2] === "completeness") return completeness_probe(process.argv[3] as string);
  const [name, run_id] = process.argv.slice(2) as [string, string];
  const sc = JSON.parse(readFileSync(resolve(__dirname, "fixtures", `${name}.json`), "utf8")) as Scenario;
  const url = process.env["DATABASE_URL"] as string;
  const env = {
    DATABASE_URL: url, AUDIT_HASH_SALT: "s", COLLAB_INTERNAL_TOKEN: "t", MODEL_PROVIDER_MODE: "stub",
    GENERATION_CONCURRENCY: "1", JOB_POLL_MS: "20", ...(sc.lease_ms ? { JOB_LEASE_MS: String(sc.lease_ms) } : {}),
  };
  const settings = load_worker_settings(env);
  const clock = new SystemClock();
  const db = new PgDatabase(settings.shared, 4, 10_000, "worker");
  const logger = create_logger({ service: "worker", build_id: "con-21", level: "info", write: (l) => void process.stderr.write(l + "\n") });
  const stub = new StubModelClient({ clock });
  const deps: WorkerDeps = { settings, logger, db: db as never, ids: new PrefixedIdGenerator(), clock, model_client: stub };
  const prices = stub_prices();
  const q = async <T,>(sql: string, p: unknown[]): Promise<T[]> => db.with_tx(async (tx) => (await tx.query<T & Record<string, unknown>>(sql, p)).rows as T[]);

  const behaviour = (id: string): Behaviour | undefined => sc.lessons[id] ?? sc.lessons["*"];
  const seen = new Map<string, number>();
  const canary = `${sc.canary_prefix}${run_id.slice(-6)}`;
  const garbage = JSON.stringify({ note: canary, markup: sc.markup ?? null });
  const ov = (await q<{ outline_version_id: string }>("select outline_version_id from run where id=$1", [run_id]))[0]!.outline_version_id;
  const rows = (await new PgOutlineRepo({ db, ids: deps.ids, clock }).rows(ov)).map((r) => r.row);
  stub.script("GENERATION", "unit_plan", (req) => plan_for(rows, req));

  const draft = (req: Parameters<typeof lesson_of>[0]): StubScriptItem => {
    const id = lesson_of(req);
    const n = (seen.get(id) ?? 0) + 1;
    seen.set(id, n);
    const b = behaviour(id);
    const good = id === "G6.U4.L4" ? wp1.draft : wp2.draft;
    if (b === "repair") return text(wp1.first_draft);
    if (b === "lost_repair") return n === 1 ? { kind: "delay", ms: 3_600_000, then: text(wp1.first_draft) } : text(wp1.first_draft);
    if (b === "truncate") return n === 1 ? { kind: "text", text: '{"lesson_id":"' + id + '","title":"cut', stop_reason: "max_tokens" } : text(good);
    return { kind: "text", text: garbage };
  };
  stub.script("GENERATION", "lesson_draft", draft);
  stub.script("REPAIR", "lesson_draft", (req) => {
    const id = lesson_of(req);
    return behaviour(id) === "fail" ? { kind: "text", text: garbage } : text(id === "G6.U4.L4" ? wp1.draft : wp2.draft);
  });
  const wiring = wire_generation(deps, { prices });
  const finished = async (): Promise<boolean> => {
    const r = await q<{ state: string }>("select state from run where id=$1", [run_id]);
    return r[0] !== undefined && !["planning", "running", "queued"].includes(r[0].state);
  };
  const drive = async (loop: typeof wiring.claim_loop, until: () => Promise<boolean>, ms = 90_000): Promise<boolean> => {
    const stop = stopper();
    const exit = loop.run_until(stop);
    const end = Date.now() + ms;
    let ok = false;
    while (Date.now() < end) { if (await until()) { ok = true; break; } await sleep(25); }
    stop.flag = true;
    await exit;
    return ok;
  };

  let ok: boolean;
  const lost = Object.entries(sc.lessons).find(([, b]) => b === "lost_repair");
  if (lost) {
    // Loop A takes the lost lesson's first call in flight and is abandoned; loop B starts, marks the call lost and requeues.
    const stopA = stopper();
    const exitA = wiring.claim_loop.run_until(stopA);
    const sent = async () => (await q("select 1 from model_call where run_id=$1 and lesson_id=$2 and status='sent'", [run_id, lost[0]])).length > 0;
    const until = Date.now() + 60_000;
    while (!(await sent()) && Date.now() < until) await sleep(25);
    stopA.flag = true;
    await sleep(sc.lease_ms! + 150);
    const second = wire_generation(deps, { prices });
    const report = await second.claim_loop.start();
    console.error("restart report", JSON.stringify(report));
    ok = await drive(second.claim_loop, finished);
    void exitA; // the abandoned call never answers; process.exit below ends it
  } else {
    ok = await drive(wiring.claim_loop, finished);
  }
  await db.close().catch(() => undefined);
  console.log(JSON.stringify({ run_id, finished: ok }));
  process.exit(ok ? 0 : 1);
}
void main().catch((e) => { console.error(e instanceof Error ? e.stack : e); process.exit(2); });
