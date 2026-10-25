// NL-79: a run started by RunService.start becomes stored lessons through the real ClaimLoop on StubModelClient.
// Names follow the ticket: test_unit_plan_capture, test_lesson_job_capture, wp2_excerpt_slot, pinned_prompt_and_provenance,
// cap_is_never_passed, restart_reuses_checkpoint, concurrency_and_fair_share, no_provider_key_anywhere.
import { spawnSync } from "node:child_process";
import Decimal from "decimal.js";
import { afterEach, describe, expect, it } from "vitest";
import { ProviderError } from "@ls/core/errors";
import type { ModelClient, ModelResponse, StructuredCallRequest } from "@ls/core/ports/model-client";
import { max_call_cost, settle_cost } from "@ls/core/spend/reservation";
import { load_worker_settings } from "@ls/config/settings";
import { ConfigError } from "@ls/config/errors";
import { locked_hash, LOCKED_DIR } from "@ls/prompts/locked";
import type { StubModelClient } from "@ls/llm/stub";
import { safety_source_rows } from "../generation/nodes/store-node.ts";
import { lesson_of, load_fixture, make_world, plan_for, stub_prices, text, World } from "../../test/support/world.ts";

const REPO = new URL("../../../../", import.meta.url).pathname;
const L4 = "G6.U4.L4";
const L5 = "G6.U4.L5";
const worlds: World[] = [];
const world = async (...a: Parameters<typeof make_world>): Promise<World> => {
  const w = await make_world(...a);
  worlds.push(w);
  return w;
};
afterEach(async () => {
  for (const w of worlds.splice(0)) await w.close();
});
const wp1 = load_fixture("wp-1.json");
const wp2 = load_fixture("wp-2.json");

/** Plan from the request's rows; WP-1 first draft then repair for L4; WP-2 for L5; anything else is an empty object. */
function script_wp(w: World): void {
  w.stub.script("GENERATION", "unit_plan", (req) => plan_for(w.rows, req));
  w.stub.script("GENERATION", "lesson_draft", (req) => {
    const id = lesson_of(req);
    return id === L4 ? text(wp1.first_draft) : id === L5 ? text(wp2.draft) : { kind: "text", text: "{}" };
  });
  w.stub.script("REPAIR", "lesson_draft", (req) => (lesson_of(req) === L4 ? text(wp1.draft) : text(wp2.draft)));
}
const job_ready = (w: World, run_id: string, lesson: string) => async (): Promise<boolean> =>
  (await w.query("select 1 from lesson_job where run_id=$1 and lesson_id=$2 and status='ready'", [run_id, lesson])).length > 0;

describe("generation wiring", () => {
  it("test_unit_plan_capture: the plan is stored before any lesson job starts, and the run is running after it", async () => {
    let seen: { state: string; plan_stored_at: unknown } | null = null;
    let run_id = "";
    const ref: { w?: World } = {};
    const w = await world({
      on_enter: async (req) => {
        if (req.output_schema_name === "LessonDraft" && seen === null) {
          const r = await ref.w!.query<{ state: string; plan_stored_at: unknown }>("select state, plan_stored_at from run where id=$1", [run_id]);
          seen = r[0] ?? null;
        }
      },
    });
    ref.w = w;
    script_wp(w);
    run_id = await w.start_run([8, 9, 25]);
    expect(await w.drive_until(() => w.run_finished(run_id), 60_000)).toBe(true);

    const plans = await w.query<{ n: number; entries: number }>("select count(*)::int n, max(jsonb_array_length(entries_json->'entries'))::int entries from unit_plan where run_id=$1", [run_id]);
    expect(plans[0]).toEqual({ n: 1, entries: 3 });
    const calls = await w.query<{ rendered_prompt: string; raw_output: string; status: string }>("select rendered_prompt, raw_output, status from model_call where run_id=$1 and purpose='unit_plan'", [run_id]);
    expect(calls).toHaveLength(1);
    expect(calls[0]!.rendered_prompt.length).toBeGreaterThan(100);
    expect(calls[0]!.raw_output.length).toBeGreaterThan(10);
    const order = await w.query<{ before: boolean }>("select r.plan_stored_at < (select min(started_at) from lesson_job where run_id=r.id and kind='lesson') as before from run r where id=$1", [run_id]);
    expect(order[0]!.before).toBe(true);
    expect(seen).not.toBeNull();
    expect(seen!.state).toBe("running");
    expect(seen!.plan_stored_at).not.toBeNull();
    console.info("unit plan evidence", { entries: plans[0]!.entries, state_at_first_lesson_call: seen!.state });
  }, 90_000);

  it("test_lesson_job_capture: draft, repair, reservations, calls, version, doc, issues and links all land", async () => {
    const w = await world();
    script_wp(w);
    const run_id = await w.start_run([8]);
    expect(await w.drive_until(job_ready(w, run_id, L4), 60_000)).toBe(true);

    const [job] = await w.query<{ id: string; repairs: number; status: string }>("select id, repairs, status from lesson_job where run_id=$1 and kind='lesson'", [run_id]);
    expect(job).toMatchObject({ status: "ready", repairs: 1 });
    const res = await w.query<{ status: string; settled_usd: string; model_call_id: string }>("select status, settled_usd, model_call_id from spend_reservation where job_id=$1", [job!.id]);
    expect(res).toHaveLength(2);
    expect(res.every((r) => r.status === "settled")).toBe(true);
    const mc = await w.query<{ id: string; purpose: string; cost_usd: string; input_tokens: number; output_tokens: number; cache_read_tokens: number; cache_write_tokens: number; rendered_prompt: string; raw_output: string }>(
      "select * from model_call where job_id=$1 order by sent_at", [job!.id]);
    expect(mc.map((m) => m.purpose)).toEqual(["lesson_draft", "repair"]);
    const price = stub_prices().price_for("stub-model");
    for (const m of mc) {
      const expected = settle_cost(price, { input_tokens: m.input_tokens, output_tokens: m.output_tokens, cache_read_tokens: m.cache_read_tokens, cache_write_tokens: m.cache_write_tokens });
      expect(new Decimal(m.cost_usd).equals(expected)).toBe(true);
      expect(m.rendered_prompt.length).toBeGreaterThan(100);
      expect(m.raw_output.length).toBeGreaterThan(10);
      expect(new Decimal(res.find((r) => r.model_call_id === m.id)!.settled_usd).equals(expected)).toBe(true);
    }
    const versions = await w.query<{ number: number; kind: string; run_id: string; provenance_json: Record<string, unknown> }>("select number, kind, run_id, provenance_json from lesson_version where lesson_id=$1", [L4]);
    expect(versions).toHaveLength(1);
    expect(versions[0]).toMatchObject({ number: 1, kind: "generated", run_id });
    expect(versions[0]!.provenance_json["run_id"]).toBe(run_id);
    expect(await w.query("select 1 from lesson_doc where lesson_id=$1", [L4])).toHaveLength(1);
    expect((await w.query<{ state: string }>("select state from lesson where id=$1", [L4]))[0]!.state).toBe("draft");

    // The check lane is NL-81's; one queued check is driven by hand so issue and alignment_link rows exist.
    const checked = (await w.run_checks_for()).find((c) => c.lesson_id === L4);
    expect(checked).toBeDefined();
    expect(checked!.links).toBeGreaterThan(0);
    expect((await w.query("select 1 from issue where lesson_id=$1", [L4])).length).toBeGreaterThan(0);
    expect((await w.query("select 1 from alignment_link where lesson_id=$1", [L4])).length).toBe(checked!.links);
    const flags = await w.query("select 1 from safety_flag where lesson_id=$1", [L4]);
    expect(flags).toHaveLength(safety_source_rows(w.row(8)).length);
    // run_id on every row that has the column
    for (const t of ["model_call", "spend_reservation", "lesson_job", "lesson_version"]) {
      const bad = await w.query(`select 1 from ${t} where run_id is distinct from $1`, [run_id]);
      expect(bad, t).toHaveLength(0);
    }
  }, 90_000);

  it("wp2_excerpt_slot: the Writing lesson keeps exactly one excerpt slot and no quoted text", async () => {
    const w = await world();
    script_wp(w);
    const run_id = await w.start_run([9]);
    expect(await w.drive_until(job_ready(w, run_id, L5), 60_000)).toBe(true);
    const [doc] = await w.query<{ derived_json: unknown }>("select derived_json from lesson_doc where lesson_id=$1 order by seq desc limit 1", [L5]);
    const types: string[] = [];
    const walk = (n: unknown): void => {
      if (n === null || typeof n !== "object") return;
      const o = n as { type?: string; content?: unknown[]; sections?: unknown[] };
      if (typeof o.type === "string") types.push(o.type);
      for (const k of Object.values(o)) if (Array.isArray(k)) k.forEach(walk); else if (k && typeof k === "object") walk(k);
    };
    walk(doc!.derived_json);
    expect(types.filter((t) => t === "excerpt_slot")).toHaveLength(1);
    expect(types.filter((t) => /quote|blockquote/.test(t))).toHaveLength(0);
    const v = await w.query<{ number: number }>("select number from lesson_version where lesson_id=$1", [L5]);
    expect(v.map((r) => r.number)).toEqual([1]);
    expect((await w.query<{ state: string }>("select state from lesson where id=$1", [L5]))[0]!.state).toBe("draft");
    const cards = JSON.stringify(doc!.derived_json);
    expect(cards).not.toContain('"content_available":true');
  }, 90_000);

  it("pinned_prompt_and_provenance: every call starts with the locked layer and provenance names the pinned prompt", async () => {
    const w = await world();
    script_wp(w);
    const run_id = await w.start_run([8]);
    expect(await w.drive_until(job_ready(w, run_id, L4), 60_000)).toBe(true);
    const [run] = await w.query<{ prompt_version_id: string }>("select prompt_version_id from run where id=$1", [run_id]);
    expect(run!.prompt_version_id).toBe(w.prompt_version_id);
    const [pv] = await w.query<{ locked_hash: string }>("select locked_hash from prompt_version where id=$1", [run!.prompt_version_id]);
    expect(pv!.locked_hash).toBe(locked_hash(LOCKED_DIR));
    const locked = w.stub.calls[0]!.system_blocks.find((b) => b.label === "locked")!.text;
    const prompts = await w.query<{ rendered_prompt: string }>("select rendered_prompt from model_call where run_id=$1", [run_id]);
    expect(prompts.length).toBeGreaterThanOrEqual(3);
    for (const p of prompts) expect(p.rendered_prompt.startsWith("### locked\n" + locked.slice(0, 200))).toBe(true);
    const [ver] = await w.query<{ provenance_json: Record<string, unknown> }>("select provenance_json from lesson_version where lesson_id=$1", [L4]);
    expect(ver!.provenance_json["prompt_version_id"]).toBe(run!.prompt_version_id);
    // Follow-up: DraftNode and StoreNode (NL-29) pass example_set_id null and no example-set repo exists; it is recorded, never invented.
    expect(Object.keys(ver!.provenance_json)).toContain("example_set_id");
    const example = ver!.provenance_json["example_set_id"];
    expect(example === null || !String(example).startsWith("G6.U4")).toBe(true);
  }, 90_000);

  it("cap_is_never_passed: spend never exceeds the run cap and the run ends capped with the later job failed", async () => {
    const prices = stub_prices("100.00", "0.00");
    const w = await world({ prices });
    w.stub.script("GENERATION", "unit_plan", (req) => plan_for(w.rows, req));
    w.stub.script("GENERATION", "lesson_draft", (req) => text(lesson_of(req) === L4 ? wp1.draft : wp2.draft)); // valid first time: one call per lesson
    const cap = 3.3;
    const price = prices.price_for("stub-model");
    expect(max_call_cost(price, 5000, 32000).toNumber()).toBeGreaterThan(3.19);
    const run_id = await w.start_run([8, 9], cap);
    let worst = 0;
    const watcher = setInterval(() => {
      void w.query<{ t: string }>(
        "select coalesce(sum(settled_usd),0)+coalesce(sum(case when status='reserved' then reserved_usd else 0 end),0) as t from spend_reservation where run_id=$1", [run_id],
      ).then((r) => { worst = Math.max(worst, Number(r[0]!.t)); }, () => undefined);
    }, 50);
    try {
      expect(await w.drive_until(() => w.run_finished(run_id), 60_000)).toBe(true);
    } finally {
      clearInterval(watcher);
    }
    expect(worst).toBeLessThanOrEqual(cap);
    const [run] = await w.query<{ state: string; capped_by: string | null }>("select state, capped_by from run where id=$1", [run_id]);
    expect(run).toMatchObject({ capped_by: "run_cap" });
    const jobs = await w.query<{ lesson_id: string; status: string; failure_reasons_json: unknown }>("select lesson_id, status, failure_reasons_json from lesson_job where run_id=$1 and kind='lesson'", [run_id]);
    const failed = jobs.filter((j) => j.status !== "ready");
    expect(failed).toHaveLength(1);
    expect(JSON.stringify(failed[0]!.failure_reasons_json)).toContain("cap");
    expect(await w.query("select 1 from lesson_version where lesson_id=$1", [failed[0]!.lesson_id])).toHaveLength(0);
    const counts = await w.query<{ r: number; m: number }>("select (select count(*) from spend_reservation where run_id=$1)::int r, (select count(*) from model_call where run_id=$1)::int m", [run_id]);
    expect(counts[0]!.r).toBe(counts[0]!.m); // a refused reservation writes neither row
    console.info("cap evidence", { cap, worst, state: run!.state });
  }, 90_000);

  it("restart_reuses_checkpoint: a second worker requeues the lapsed job, releases the hold and does not redraft", async () => {
    // The stub's delay stands in for a worker that died mid-repair: it never answers inside the lease.
    const w = await world({ env: { JOB_LEASE_MS: "300", JOB_POLL_MS: "20" } });
    w.stub.script("GENERATION", "unit_plan", (req) => plan_for(w.rows, req));
    w.stub.script("GENERATION", "lesson_draft", [text(wp1.first_draft)]);
    w.stub.script("REPAIR", "lesson_draft", [{ kind: "delay", ms: 4000, then: text(wp1.draft) }, text(wp1.draft)]);
    const run_id = await w.start_run([8]);
    const stop_a = { flag: false, is_set(): boolean { return this.flag; } };
    const exit_a = w.loop.run_until(stop_a);
    const sent = async (): Promise<boolean> => (await w.query("select 1 from model_call where run_id=$1 and purpose='repair' and status='sent'", [run_id])).length > 0;
    const until = Date.now() + 30_000;
    while (!(await sent()) && Date.now() < until) await new Promise((r) => setTimeout(r, 25));
    expect(await sent()).toBe(true);
    expect((await w.query("select 1 from spend_reservation where run_id=$1 and purpose='repair' and status='reserved'", [run_id])).length).toBe(1);
    stop_a.flag = true;
    await new Promise((r) => setTimeout(r, 450)); // the 300 ms lease lapses; loop A's 30 s renew timer cannot fire

    const second = w.rewire();
    const report = await second.claim_loop.start();
    expect(report.requeued_at_start).toBe(1);
    expect(report.reservations_released).toBe(1);
    expect(report.lost_calls_marked).toBe(1);
    expect(await w.drive_until(job_ready(w, run_id, L4), 30_000, second.claim_loop)).toBe(true);
    const mc = await w.query<{ purpose: string; status: string }>("select purpose, status from model_call where run_id=$1 and lesson_id=$2 order by sent_at", [run_id, L4]);
    expect(mc.filter((m) => m.purpose === "lesson_draft")).toHaveLength(1); // the checkpoint was reused
    expect(mc.filter((m) => m.purpose === "repair").map((m) => m.status).sort()).toEqual(["completed", "lost"]);
    expect(await w.query("select 1 from lesson_version where lesson_id=$1", [L4])).toHaveLength(1);
    await exit_a; // let the abandoned worker finish before the database is dropped
  }, 90_000);

  it("concurrency_and_fair_share: never more than the limit in flight, and both runs progress before either finishes", async () => {
    class Counting implements ModelClient {
      inflight = 0;
      max = 0;
      constructor(private readonly inner: StubModelClient) {}
      async complete(req: StructuredCallRequest): Promise<ModelResponse> {
        this.inflight++;
        this.max = Math.max(this.max, this.inflight);
        try {
          return await this.inner.complete(req);
        } finally {
          this.inflight--;
        }
      }
    }
    let counting!: Counting;
    // rules: [] so only the schema and compile gate these drafts (the same WP-1 draft is reused for every Reading row).
    const w = await world({ env: { GENERATION_CONCURRENCY: "6" }, rules: [], wrap: (s) => (counting = new Counting(s)) });
    const reading = w.rows.filter((r) => r.lesson_type === "Reading" && r.lesson_id !== null).map((r) => r.row_number);
    const a = reading.slice(0, 5);
    const b = reading.slice(5, 10);
    w.stub.script("GENERATION", "unit_plan", (req) => plan_for(w.rows, req));
    w.stub.script("GENERATION", "lesson_draft", (req) => ({ kind: "delay", ms: 150, then: text({ ...(wp1.draft as object), lesson_id: lesson_of(req) }) }));
    const run_a = await w.start_run(a);
    const run_b = await w.start_run(b);
    const done = async (): Promise<boolean> => (await w.run_finished(run_a)) && (await w.run_finished(run_b));
    expect(await w.drive_until(done, 90_000)).toBe(true);
    expect(counting.max).toBeLessThanOrEqual(6);
    expect(counting.max).toBeGreaterThan(1);
    console.info("max in flight", counting.max);
    const t = async (run: string, agg: "min" | "max") =>
      (await w.query<{ t: Date }>(`select ${agg}(finished_at) t from lesson_job where run_id=$1 and kind='lesson' and finished_at is not null`, [run]))[0]!.t.getTime();
    // Reading drafts reuse the WP-1 draft: if some do not compile, finished_at (any outcome) still shows the interleaving.
    expect(await t(run_a, "min")).toBeLessThan(await t(run_b, "max"));
    expect(await t(run_b, "min")).toBeLessThan(await t(run_a, "max"));
    expect(await w.query("select 1 from lesson_job where run_id in ($1,$2) and kind='lesson' and finished_at is null", [run_a, run_b])).toHaveLength(0);
  }, 120_000);

  it("no_provider_key_anywhere: the canary key reaches no table, log line or error text; a missing key stops the worker", async () => {
    const CANARY = "sk-ant-CANARY-4417";
    // A keyed stand-in for the provider adapter: like the real one it reads the configured key (from the loaded
    // settings, at call time) and puts it in the outgoing request object, so a leak path has something to leak.
    const sent: Array<{ headers: { "x-api-key": string }; body: StructuredCallRequest }> = [];
    let keyed: World | undefined;
    const wrap = (inner: StubModelClient): ModelClient => ({
      complete: (req) => {
        const key = keyed!.deps.settings.model.anthropic_api_key;
        if (key === null) return Promise.reject(new Error("test setup: no key configured"));
        sent.push({ headers: { "x-api-key": key.reveal() }, body: req });
        return inner.complete(req);
      },
    });
    const w = (keyed = await world({ env: { ANTHROPIC_API_KEY: CANARY }, wrap }));
    const boom = new ProviderError({ kind: "overloaded", http_status: 529 });
    w.stub.script("GENERATION", "unit_plan", (req) => plan_for(w.rows, req));
    w.stub.script("GENERATION", "lesson_draft", (req) => (lesson_of(req) === L5 ? { kind: "error", error: boom } : text(wp1.draft)));
    const run_id = await w.start_run([8, 9]);
    const finished = await w.drive_until(() => w.run_finished(run_id), 60_000);
    expect(finished).toBe(true);
    const tables = await w.query<{ table_name: string }>("select table_name from information_schema.tables where table_schema='public' and table_type='BASE TABLE'");
    let dump = "";
    for (const t of tables) dump += (await w.query<{ j: string }>(`select row_to_json(t)::text j from ${t.table_name} t`)).map((r) => r.j).join("\n");
    expect(dump.length).toBeGreaterThan(1000);
    // The key really was read and sent on every provider call (so the checks below are not vacuous).
    expect(sent.length).toBeGreaterThan(2);
    expect(sent.every((s) => s.headers["x-api-key"] === CANARY)).toBe(true);
    expect(dump).not.toContain(CANARY);
    expect(w.lines.join("\n")).not.toContain(CANARY);
    expect(String(boom) + JSON.stringify(boom)).not.toContain(CANARY);
    expect(JSON.stringify(w.deps.settings)).not.toContain(CANARY);

    const env = { DATABASE_URL: "postgres://u:p@127.0.0.1:1/x", AUDIT_HASH_SALT: "s", COLLAB_INTERNAL_TOKEN: "t", MODEL_PROVIDER_MODE: "real" };
    let thrown: unknown;
    try {
      load_worker_settings(env);
    } catch (e) {
      thrown = e;
    }
    expect(thrown).toBeInstanceOf(ConfigError);
    expect((thrown as Error).message).toContain("ANTHROPIC_API_KEY");
    const out = spawnSync("npx", ["tsx", "apps/worker/src/main.ts"], { env: { PATH: process.env["PATH"] ?? "", HOME: process.env["HOME"] ?? "", ...env }, cwd: REPO, encoding: "utf8", timeout: 60_000 });
    expect(out.status).not.toBe(0);
    expect(out.stderr).toContain("worker failed to start: ConfigError (ANTHROPIC_API_KEY)");
    expect(out.stdout + out.stderr).not.toContain(CANARY);
  }, 120_000);
});
