// NL-27: PgRunRepo against real Postgres.
import Decimal from "decimal.js";
import { FakeClock } from "@ls/core/ports/clock";
import { PrefixedIdGenerator } from "@ls/core/ports/ids";
import type { NewRun } from "@ls/core/ports/runs";
import type { IntakeChoiceRow, LessonLinkRecord } from "@ls/core/ports/outlines";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { insert_row } from "../testing/insert-row.ts";
import { create_test_db, type TestDb } from "../testing/test-db.ts";
import { PgRunRepo } from "./runs.ts";

let t: TestDb;
let clock: FakeClock;
let repo: PgRunRepo;
const ids = new PrefixedIdGenerator();
const USER = ids.new_id("usr");
const OTHER = ids.new_id("usr");
const OV = "G6.U4.ov1";

const choice = (finding_id: string, choice_: string): IntakeChoiceRow =>
  ({ outline_version_id: OV, finding_id, choice: choice_, status: "confirmed", confirmed_by: USER, at: new Date("2026-10-25T10:00:00.000Z") }) as unknown as IntakeChoiceRow;
const link = (n: number): LessonLinkRecord =>
  ({ link_id: `lk_${n}`, from_lesson_id: "G6.U4.L1", from_address: "a", to_lesson_id: "G6.U4.L2", to_slot_id: `s${n}`, kind: "excerpt_slot", label: "x" }) as unknown as LessonLinkRecord;
const new_run = (over: Partial<NewRun> = {}): NewRun => ({
  unit_id: "unit_1", outline_version_id: OV, kind: "run", prompt_version_id: "pv_1", cap_usd: new Decimal("13.00"),
  scope_rows: null, started_by: USER, parent_run_id: null, eval_run_id: null, choices: [], choices_hash: "h".repeat(64),
  lesson_links: [], idempotency_key: null, ...over,
} as unknown as NewRun);
const q = async (sql: string, values: unknown[] = []): Promise<Record<string, unknown>[]> => t.db.with_tx(async (tx) => (await tx.query(sql, values)).rows);

beforeAll(async () => {
  t = await create_test_db();
  clock = new FakeClock(new Date("2026-10-25T12:00:00.000Z"));
  repo = new PgRunRepo({ db: t.db, ids, clock });
});
afterAll(async () => {
  await t.drop();
});

describe("PgRunRepo", () => {
  it("insert_run: one run, one unit_plan, Decimal cap; trial gets no plan", async () => {
    const links = [link(1), link(2)];
    const row = await t.db.with_tx((tx) => repo.insert_run(new_run({ lesson_links: links }), tx));
    expect(row.state).toBe("planning");
    expect(row.kind).toBe("run");
    expect(row.cap_usd.toFixed(2)).toBe("13.00");
    expect(row.finished_at).toBeNull();
    expect((await q("SELECT * FROM run WHERE id=$1", [row.run_id]))).toHaveLength(1);
    const plan = await repo.unit_plan(row.run_id);
    expect(plan?.state).toBe("planning");
    expect(plan?.lesson_links).toEqual(links);

    const trial = await t.db.with_tx((tx) => repo.insert_run(new_run({ kind: "trial" }), tx));
    expect(await repo.unit_plan(trial.run_id)).toBeNull();
    expect((await repo.get(trial.run_id))?.kind).toBe("trial");
    expect(await repo.get("run_nope" as never)).toBeNull();
  });

  it("idempotency_key: replay, concurrent twins, 24 h expiry, other user", async () => {
    const K = "key-1";
    const flow = (user: string) =>
      t.db.with_tx(async (tx) => {
        const f = await repo.find_by_idempotency_key(user as never, K, 24);
        return f ?? repo.insert_run(new_run({ started_by: user as never, idempotency_key: K }), tx);
      }, "run:start:" + user + K);

    const [a, b] = await Promise.all([flow(USER), flow(USER)]);
    expect(a.run_id).toBe(b.run_id);
    expect(await q("SELECT 1 FROM run WHERE started_by=$1 AND idempotency_key=$2", [USER, K])).toHaveLength(1);
    expect((await repo.find_by_idempotency_key(USER, K, 24))?.run_id).toBe(a.run_id);

    const other = await flow(OTHER);
    expect(other.run_id).not.toBe(a.run_id);

    clock.advance(25 * 3_600_000);
    expect(await repo.find_by_idempotency_key(USER, K, 24)).toBeNull();
    const again = await flow(USER);
    expect(again.run_id).not.toBe(a.run_id);
    expect(await q("SELECT 1 FROM run WHERE started_by=$1 AND id IN ($2,$3)", [USER, a.run_id, again.run_id])).toHaveLength(2);
  });

  it("run_pins_choices_and_prompt: later changes do not move a started run", async () => {
    const choices = [choice("f1", "keep"), choice("f2", "drop")];
    const links = [link(7), link(8)];
    const row = await t.db.with_tx((tx) => repo.insert_run(new_run({ choices, lesson_links: links, choices_hash: "c".repeat(64) }), tx));
    const before = { run: await repo.get(row.run_id), choices: await repo.pinned_choices(row.run_id), plan: await repo.unit_plan(row.run_id) };
    expect(before.choices).toHaveLength(2);
    expect(before.run?.choices_hash).toBe("c".repeat(64));
    expect(before.run?.prompt_version_id).toBe("pv_1");

    await t.db.with_tx(async (tx) => {
      await insert_row(tx, "intake_choice", { outline_version_id: OV, finding_id: "f1", choice: "changed", status: "confirmed" });
      await insert_row(tx, "prompt_version", { id: "pv_2", number: 2 });
    });
    const after = { run: await repo.get(row.run_id), choices: await repo.pinned_choices(row.run_id), plan: await repo.unit_plan(row.run_id) };
    expect(after).toEqual(before);
    expect(after.plan?.lesson_links).toEqual(links);
  });

  it("transitions: store_unit_plan, mark_capped, mark_plan_failed, lock_for_update", async () => {
    // store_unit_plan
    const r1 = await t.db.with_tx((tx) => repo.insert_run(new_run(), tx));
    const draft = { entries: [{ lesson_id: "G6.U4.L1", day: 1, purpose: "p", routines: [], hands_forward: "h", performance_task_thread: "t" }] };
    const stored = await repo.store_unit_plan(r1.run_id, draft as never, "mc_1" as never);
    expect(stored.state).toBe("stored");
    expect(stored.plan).toEqual(draft);
    expect(stored.model_call_id).toBe("mc_1");
    const after = await repo.get(r1.run_id);
    expect(after?.state).toBe("running");
    expect(after?.plan_stored_at).not.toBeNull();

    // after Resume (state already running) a late plan still stamps plan_stored_at
    const rr = await t.db.with_tx((tx) => repo.insert_run(new_run(), tx));
    await t.db.with_tx((tx) => repo.set_state(rr.run_id, "running", null, tx));
    expect((await repo.get(rr.run_id))?.plan_stored_at).toBeNull();
    await repo.store_unit_plan(rr.run_id, draft as never, "mc_3" as never);
    const resumed = await repo.get(rr.run_id);
    expect(resumed?.state).toBe("running");
    expect(resumed?.plan_stored_at).not.toBeNull();

    // mark_capped, each cap
    for (const cap of ["run_cap", "day_cap", "project_cap"] as const) {
      const r = await t.db.with_tx((tx) => repo.insert_run(new_run(), tx));
      const capped = await t.db.with_tx((tx) => repo.mark_capped(r.run_id, cap, tx));
      expect(capped.state).toBe("capped");
      expect(capped.capped_by).toBe(cap);
      expect(capped.finished_at).not.toBeNull();
    }

    // a cancelled run stays cancelled when its plan arrives late
    const rc = await t.db.with_tx((tx) => repo.insert_run(new_run(), tx));
    await t.db.with_tx((tx) => repo.set_state(rc.run_id, "cancelled", null, tx));
    await repo.store_unit_plan(rc.run_id, draft as never, "mc_2" as never);
    expect((await repo.get(rc.run_id))?.state).toBe("cancelled");

    // mark_plan_failed
    const r2 = await t.db.with_tx((tx) => repo.insert_run(new_run(), tx));
    const failed = await t.db.with_tx((tx) => repo.mark_plan_failed(r2.run_id, tx));
    expect(failed.state).toBe("paused");
    expect(failed.paused_check).toBe("unit_plan");
    expect((await repo.unit_plan(r2.run_id))?.state).toBe("failed");

    // lock_for_update blocks a second writer until the first commits
    const r3 = await t.db.with_tx((tx) => repo.insert_run(new_run(), tx));
    let release!: () => void;
    const gate = new Promise<void>((res) => (release = res));
    let locked!: () => void;
    const has_lock = new Promise<void>((res) => (locked = res));
    const a = t.db.with_tx(async (tx) => {
      await repo.lock_for_update(r3.run_id, tx);
      locked();
      await gate;
    });
    await has_lock;
    let b_done = false;
    const b = t.db.with_tx((tx) => repo.lock_for_update(r3.run_id, tx)).then(() => (b_done = true));
    await new Promise((res) => setTimeout(res, 150));
    expect(b_done).toBe(false);
    release();
    await a;
    await b;
    expect(b_done).toBe(true);
    await expect(t.db.with_tx((tx) => repo.lock_for_update("run_none" as never, tx))).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("summary_rows and active_runs read back what was written", async () => {
    const r = await t.db.with_tx((tx) => repo.insert_run(new_run(), tx));
    await t.db.with_tx(async (tx) => {
      await insert_row(tx, "lesson_job", { id: "job_s1", run_id: r.run_id, kind: "lesson", lesson_id: "G6.U4.L1", status: "ready", tile_state: "ready", cost_usd: "0.5" });
      await insert_row(tx, "model_call", { id: "mc_s1", run_id: r.run_id, purpose: "repair", status: "completed", cost_usd: "0.5", input_tokens: 10, output_tokens: 5, retries: 1 });
    });
    const s = await repo.summary_rows(r.run_id);
    expect(s.jobs).toHaveLength(1);
    expect(s.jobs[0]?.cost_usd.toFixed(2)).toBe("0.50");
    expect(s.calls).toMatchObject({ calls: 1, completed: 1, repairs: 1, retries: 1, input_tokens: 10, output_tokens: 5 });
    expect(s.calls.cost_usd.toFixed(2)).toBe("0.50");
    expect(s.placeholders_left).toBe(0);
    expect(s.report_path).toBeNull();
    expect((await repo.active_runs()).some((x) => x.run_id === r.run_id)).toBe(true);
  });
});
