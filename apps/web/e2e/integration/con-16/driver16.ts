// NL-114: drives the worker's real claim loop (wire_generation) against the stack database on the scripted StubModelClient.
// Stand-in for the worker process, which cannot take per-test scripted replies (S-28b). Run as a child, one JSON line on stdout:
//   DATABASE_URL=... npx tsx e2e/integration/con-16/driver16.ts parent <good|fail> <runId>
//   DATABASE_URL=... npx tsx e2e/integration/con-16/driver16.ts candidate <good|fail|markup|edit> <runId> [delayMs] [editText]
import { load_worker_settings } from "@ls/config/settings";
import { SystemClock } from "@ls/core/ports/clock";
import { PrefixedIdGenerator } from "@ls/core/ports/ids";
import { PgDatabase } from "@ls/db/pool";
import { StubModelClient, type StubScriptItem } from "@ls/llm/stub";
import { create_logger } from "@ls/obs/logger";
import { lesson_of, load_fixture, plan_for, stub_prices, text } from "../../../../worker/test/support/world.ts";
import { PgOutlineRepo } from "@ls/db/repos/outlines";
import type { WorkerDeps } from "../../../../worker/src/deps-types.ts";
import { wire_generation } from "../../../../worker/src/wiring/generation.ts";
import type { StopSignal } from "../../../../worker/src/queue/claim-loop.ts";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const wp1 = load_fixture("wp-1.json");
const wp2 = load_fixture("wp-2.json");
export const MARKUP = "<script>window.__pwn=1</script>";

interface Block { role: string; text: string }
/** wp-1's draft with its first sample_response replaced by script markup (a model answering with markup). */
function withSampleResponse(replacement: string): unknown {
  const d = JSON.parse(JSON.stringify(wp1.draft)) as { blocks: Block[] };
  const b = d.blocks.find((x) => x.role === "sample_response");
  if (!b) throw new Error("wp-1 draft has no sample_response block");
  b.text = replacement;
  return d;
}

async function main(): Promise<void> {
  const [kind, ...rest] = process.argv.slice(2) as [string, ...string[]];
  const url = process.env["DATABASE_URL"] as string;
  const mode = rest.shift() as "good" | "fail" | "markup" | "edit";
  const run_id = rest[0] as string;
  const delay_ms = Number(rest[1] ?? 0);
  const edit_text = rest[2] ?? "A synthetic candidate sentence about voice and tone.";
  const env = { DATABASE_URL: url, AUDIT_HASH_SALT: "s", COLLAB_INTERNAL_TOKEN: "t", MODEL_PROVIDER_MODE: "stub", GENERATION_CONCURRENCY: "1", JOB_POLL_MS: "20" };
  const settings = load_worker_settings(env);
  const clock = new SystemClock();
  const db = new PgDatabase(settings.shared, 4, 10_000, "worker");
  const logger = create_logger({ service: "worker", build_id: "con-16", level: "info", write: (l) => void process.stderr.write(l + "\n") });
  const stub = new StubModelClient({ clock });
  const deps: WorkerDeps = { settings, logger, db: db as never, ids: new PrefixedIdGenerator(), clock, model_client: stub };
  const q = async <T,>(sql: string, p: unknown[]): Promise<T[]> => db.with_tx(async (tx) => (await tx.query<T & Record<string, unknown>>(sql, p)).rows as T[]);

  if (kind === "parent") {
    const ov = (await q<{ outline_version_id: string }>("select outline_version_id from run where id=$1", [run_id]))[0]!.outline_version_id;
    const rows = (await new PgOutlineRepo({ db, ids: deps.ids, clock }).rows(ov)).map((r) => r.row);
    stub.script("GENERATION", "unit_plan", (req) => plan_for(rows, req));
  }
  const garbage = JSON.stringify({ note: "synthetic garbage", mode });
  const reply = (id: string): StubScriptItem => {
    if (mode === "fail") return { kind: "text", text: garbage };
    const good = mode === "markup" ? withSampleResponse(MARKUP) : mode === "edit" ? withSampleResponse(edit_text) : id === "G6.U4.L4" ? wp1.draft : wp2.draft;
    return delay_ms > 0 ? { kind: "delay", ms: delay_ms, then: text(good) } : text(good);
  };
  stub.script("GENERATION", "lesson_draft", (req) => reply(lesson_of(req)));
  stub.script("REPAIR", "lesson_draft", (req) => (mode === "fail" ? { kind: "text", text: garbage } : text(lesson_of(req) === "G6.U4.L4" ? wp1.draft : wp2.draft)));

  const wiring = wire_generation(deps, { prices: stub_prices() });
  const finished = async (): Promise<boolean> => {
    if (kind === "parent") {
      const r = await q<{ state: string }>("select state from run where id=$1", [run_id]);
      return r[0] !== undefined && !["planning", "running", "queued"].includes(r[0].state);
    }
    const jobs = await q<{ status: string }>("select status from lesson_job where run_id=$1", [run_id]);
    return jobs.length > 0 && jobs.every((j) => !["queued", "running"].includes(j.status));
  };
  const stop: StopSignal & { flag: boolean } = { flag: false, is_set() { return this.flag; } };
  const exit = wiring.claim_loop.run_until(stop);
  const end = Date.now() + 90_000;
  let ok = false;
  while (Date.now() < end) {
    if (await finished()) { ok = true; break; }
    await sleep(25);
  }
  if (!ok) {
    const jobs = await q("select id, kind, status, attempt, failure_reasons_json, lease_until from lesson_job where run_id=$1", [run_id]);
    const run = await q("select state, kind from run where id=$1", [run_id]);
    console.error("driver timeout", JSON.stringify({ run, jobs }));
  }
  stop.flag = true;
  await exit;
  let stuck: string | null = null;
  if (kind === "candidate" && ok) {
    // SEAM DEFECT (devlog, request R-1): a finished candidate run keeps run.state='planning' (derive_run_state: no plan_stored).
    // claim() only looks at the first MAX_ACTIVE_RUNS (3) runs in planning|running, so after three candidates every later job starves.
    // The worker is read-only for this ticket; the driver closes the run so the suite can go on, and prints what it found.
    stuck = (await q<{ state: string }>("select state from run where id=$1", [run_id]))[0]?.state ?? null;
    if (stuck === "planning") await q("update run set state='complete', finished_at=now() where id=$1 and kind='candidate' and state='planning'", [run_id]);
  }
  await db.close().catch(() => undefined);
  console.log(JSON.stringify({ run_id, kind, mode, finished: ok, run_state_after_job: stuck }));
  process.exit(ok ? 0 : 1);
}
void main().catch((e) => { console.error(e instanceof Error ? e.stack : e); process.exit(2); });
