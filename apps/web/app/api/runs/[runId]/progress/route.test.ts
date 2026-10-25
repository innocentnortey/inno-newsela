// @vitest-environment node
// NL-78: getRunProgress against a real test database.
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { Tx as DbTx } from "@ls/db/tx";
import type { TestDb } from "@ls/db/testing/test-db";
import { create_test_db } from "@ls/db/testing/test-db";
import { body_of, call, code_of, count, make_run_kit, seed_call, seed_lessons, seed_reservation, seed_stub_run, set_job, type RunKit } from "@/server/services/testing/run-read-harness";

let t: TestDb;
let kit: RunKit;
const q = <T>(fn: (tx: Parameters<typeof seed_lessons>[0]) => Promise<T>): Promise<T> => t.db.with_tx(async (tx) => fn(tx));
const day = (d: number) => new Date(Date.UTC(2020, 0, d));

beforeAll(async () => {
  t = await create_test_db();
  kit = make_run_kit(t);
  await q((tx) => seed_lessons(tx, 8));
});
afterAll(async () => {
  await t.drop();
});

describe("getRunProgress", () => {
  it("test_progress_reflects_jobs", async () => {
    const ids = Array.from({ length: 8 }, (_, i) => `G6.U4.L${i + 1}`);
    const s = await q((tx) => seed_stub_run(tx, { lesson_ids: ids, statuses: ["queued", "running", "running", "running", "running", "ready", "generation_failed", "cancelled"] }));
    await q(async (tx) => {
      await set_job(tx, s.jobs[1]!, { tile_state: "planning" });
      await set_job(tx, s.jobs[2]!, { tile_state: "drafting" });
      await set_job(tx, s.jobs[3]!, { tile_state: "checking" });
      await set_job(tx, s.jobs[4]!, { tile_state: "repairing" });
    });
    const res = await call(kit.handlers.progress, { run_id: s.run_id });
    expect(res.status).toBe(200);
    const b = body_of(res);
    expect(b.tiles.map((x: any) => x.tile_state)).toEqual(["queued", "planning", "drafting", "checking", "repairing", "ready", "failed", "failed"]);
    expect(b.tiles.map((x: any) => x.lesson_id)).toEqual(ids);
    expect(Object.values(b.counts_by_tile_state as Record<string, number>).reduce((a, c) => a + c, 0)).toBe(8);
    expect(b.counts_by_tile_state).toMatchObject({ queued: 1, planning: 1, drafting: 1, checking: 1, repairing: 1, ready: 1, failed: 2 });
    expect(b.tiles[0]).toMatchObject({ number: 1, title: "Synthetic lesson 1", lesson_key: "L1" });
    await q((tx) => set_job(tx, s.jobs[2]!, { tile_state: "checking" }));
    const next = body_of(await call(kit.handlers.progress, { run_id: s.run_id }));
    expect(next.tiles[2].tile_state).toBe("checking");
    expect(next.counts_by_tile_state.drafting).toBe(0);
  });

  it("cap_arithmetic_and_queued_ahead", async () => {
    const [a, b, c] = await q(async (tx) => [
      await seed_stub_run(tx, { lesson_ids: ["G6.U4.L1", "G6.U4.L2"], statuses: ["queued", "queued"], queued_at: day(1) }),
      await seed_stub_run(tx, { lesson_ids: ["G6.U4.L3"], statuses: ["queued"], queued_at: day(2) }),
      await seed_stub_run(tx, { lesson_ids: ["G6.U4.L4", "G6.U4.L5", "G6.U4.L6"], statuses: ["queued", "queued", "queued"], queued_at: day(3) }),
    ] as const);
    await q(async (tx) => {
      await seed_reservation(tx, { run_id: b.run_id, status: "settled", reserved_usd: "2", settled_usd: "1.25" });
      await seed_reservation(tx, { run_id: b.run_id, status: "reserved", reserved_usd: "1.5" });
    });
    const get = async (r: { run_id: string }) => body_of(await call(kit.handlers.progress, { run_id: r.run_id }));
    expect([(await get(a)).queued_ahead, (await get(b)).queued_ahead, (await get(c)).queued_ahead]).toEqual([0, 2, 3]);
    const pb = await get(b);
    expect([pb.spent_usd, pb.reserved_usd, pb.cap_usd]).toEqual([1.25, 1.5, 13]);
    expect(pb.spent_usd + pb.reserved_usd).toBeLessThanOrEqual(pb.cap_usd);
    expect(pb.capped_by).toBeNull();
    await q((tx) => tx.query("UPDATE run SET state = 'capped', capped_by = 'run_cap' WHERE id = $1", [a.run_id]));
    expect(await get(a)).toMatchObject({ state: "capped", capped_by: "run_cap" });
  });

  it("tile_reasons_and_vocabulary", async () => {
    const s = await q((tx) => seed_stub_run(tx, { lesson_ids: ["G6.U4.L1", "G6.U4.L2"], statuses: ["ready", "generation_failed"] }));
    await q(async (tx) => {
      await set_job(tx, s.jobs[0]!, { truncation_retries: 1, repairs: 0 });
      await set_job(tx, s.jobs[1]!, { failure_reasons_json: JSON.stringify([{ check: "check_failed", check_kind: "missing_slot", message: "x" }, { check: "bogus" }]) });
    });
    const b = body_of(await call(kit.handlers.progress, { run_id: s.run_id }));
    expect(b.tiles[0]).toMatchObject({ truncation_retry_used: true, repair_used: false });
    expect(b.tiles[1].failure_reasons).toEqual([{ check: "check_failed", check_kind: "missing_slot", message: "x" }]);

    const c = await q((tx) => seed_stub_run(tx, { lesson_ids: ["G6.U4.L3"], statuses: ["queued"] }));
    const cancel = await call(kit.handlers.actions, { run_id: c.run_id, method: "POST", body: { action: "cancel" } });
    expect(cancel.status).toBe(200);
    const tile = body_of(await call(kit.handlers.progress, { run_id: c.run_id })).tiles[0];
    expect(tile).toMatchObject({ tile_state: "failed", openable: false });
    expect(tile.failure_reasons).toHaveLength(1);
    expect(tile.failure_reasons[0].check).toBe("cancelled");
    expect(tile.failure_reasons[0].message.length).toBeGreaterThan(0);
  });

  it("indexed_read_no_writes", async () => {
    const s = await q((tx) => seed_stub_run(tx, { lesson_ids: ["G6.U4.L1", "G6.U4.L2"], statuses: ["queued", "ready"] }));
    const tables = ["run", "lesson_job", "spend_reservation", "audit_event"];
    const before = await Promise.all(tables.map((n) => q((tx) => count(tx, n))));
    const spy = vi.spyOn(DbTx.prototype, "query");
    let texts: string[];
    try {
      expect((await call(kit.handlers.progress, { run_id: s.run_id })).status).toBe(200);
      texts = spy.mock.calls.map((c) => String(c[0]));
    } finally {
      spy.mockRestore();
    }
    expect(texts.length).toBeLessThanOrEqual(3);
    for (const x of texts) {
      expect(x.trimStart()).toMatch(/^(SELECT|WITH)/);
      expect(x).not.toMatch(/\b(INSERT|UPDATE|DELETE)\b/i);
      expect(x).toContain("run_id");
    }
    expect(await Promise.all(tables.map((n) => q((tx) => count(tx, n))))).toEqual(before);
  });
  // AC-4 index part (R2): only an NL-08-style migration may add lesson_job(run_id); NL-78 adds none. Follow-up in the devlog.
  it.todo("progress read uses the lesson_job(run_id) index");

  it("not_found_and_all_roles", async () => {
    for (const h of [kit.handlers.progress, kit.handlers.plan, kit.handlers.summary]) {
      const r = await call(h, { run_id: "run_missing" });
      expect([r.status, code_of(r)]).toEqual([404, "NOT_FOUND"]);
    }
    const s = await q((tx) => seed_stub_run(tx, {}));
    for (const token of ["author-token", "reviewer-token", "approver-token"]) {
      expect((await call(kit.handlers.progress, { run_id: s.run_id, token })).status).toBe(200);
    }
    expect((await call(kit.handlers.summary, { run_id: s.run_id, token: "approver-token" })).status).toBe(200);
  });

  it("no_key_or_prompt_in_reads", async () => {
    const prior = process.env["ANTHROPIC_API_KEY"];
    process.env["ANTHROPIC_API_KEY"] = "sk-ant-TESTMARKER-78";
    try {
      const s = await q((tx) => seed_stub_run(tx, {}));
      await q((tx) => seed_call(tx, { run_id: s.run_id, job_id: s.jobs[0]!, lesson_id: s.lesson_ids[0]!, rendered_prompt: "RAWPROMPTMARKER-78 secret instructions", cost_usd: "0.5" }));
      await q((tx) => tx.query("INSERT INTO unit_plan (run_id, state) VALUES ($1, 'planning')", [s.run_id]));
      const texts: string[] = [];
      for (const h of [kit.handlers.progress, kit.handlers.plan, kit.handlers.summary]) {
        const r = await call(h, { run_id: s.run_id });
        expect(r.status).toBe(200);
        texts.push(JSON.stringify(r.body));
      }
      const all = texts.join("\n") + kit.lines.join("\n");
      expect(all).not.toContain("sk-ant-TESTMARKER-78");
      expect(all).not.toContain("RAWPROMPTMARKER-78");
    } finally {
      if (prior === undefined) delete process.env["ANTHROPIC_API_KEY"];
      else process.env["ANTHROPIC_API_KEY"] = prior;
    }
  });
});
