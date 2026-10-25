// @vitest-environment node
// NL-78: getUnitPlan against a real test database.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { insert_row } from "@ls/db/testing/insert-row";
import { create_test_db, type TestDb } from "@ls/db/testing/test-db";
import { body_of, call, code_of, make_run_kit, seed_stub_run, type RunKit } from "@/server/services/testing/run-read-harness";

let t: TestDb;
let kit: RunKit;
const q = <T>(fn: (tx: Parameters<typeof seed_stub_run>[0]) => Promise<T>): Promise<T> => t.db.with_tx(async (tx) => fn(tx));

beforeAll(async () => {
  t = await create_test_db();
  kit = make_run_kit(t);
});
afterAll(async () => {
  await t.drop();
});

const entries = Array.from({ length: 47 }, (_, i) => ({
  lesson_id: `G6.U4.L${i + 1}`, day: i + 1, purpose: `Synthetic purpose ${i + 1}`, routines: ["r1"], hands_forward: "next", performance_task_thread: "thread",
}));
const link = (n: number) => ({ link_id: `lk_${n}`, from_lesson_id: "G6.U4.L1", from_address: "a", to_lesson_id: "G6.U4.L2", to_slot_id: `s${n}`, kind: "excerpt_slot", label: "x" });

describe("getUnitPlan", () => {
  it("plan_states_and_47_entries", async () => {
    const s = await q((tx) => seed_stub_run(tx, { state: "planning", plan_stored_at: null }));
    await q((tx) => insert_row(tx, "unit_plan", { run_id: s.run_id, state: "planning" }));
    const planning = body_of(await call(kit.handlers.plan, { run_id: s.run_id }));
    expect(planning).toMatchObject({ run_id: s.run_id, state: "planning", stored_at: null, entries: [], lesson_links: [] });

    await q((tx) =>
      tx.query("UPDATE unit_plan SET state = 'stored', stored_at = now(), entries_json = $2::jsonb, lesson_links_json = $3::jsonb WHERE run_id = $1", [
        s.run_id, JSON.stringify({ entries: [...entries].reverse() }), JSON.stringify([link(1), link(2)]),
      ]),
    );
    const stored = body_of(await call(kit.handlers.plan, { run_id: s.run_id }));
    expect(stored.state).toBe("stored");
    expect(stored.entries).toHaveLength(47);
    expect(stored.entries[0].day).toBe(1);
    expect(stored.stored_at).toEqual(expect.any(String));
    expect(stored.lesson_links).toHaveLength(2);
    expect(Object.keys(stored.lesson_links[0]).sort()).toEqual(["from_address", "from_lesson_id", "label", "link_id", "to_lesson_id", "to_slot_id"]);

    await q(async (tx) => {
      await tx.query("UPDATE unit_plan SET state = 'failed' WHERE run_id = $1", [s.run_id]);
      await tx.query("UPDATE run SET state = 'paused', paused_check = 'unit_plan' WHERE id = $1", [s.run_id]);
    });
    expect(body_of(await call(kit.handlers.plan, { run_id: s.run_id })).state).toBe("failed");
    await q((tx) => tx.query("UPDATE run SET state = 'running', paused_check = NULL WHERE id = $1", [s.run_id]));
    expect(body_of(await call(kit.handlers.plan, { run_id: s.run_id })).state).toBe("planning");
  });

  it("a trial run has no plan: 404", async () => {
    const s = await q((tx) => seed_stub_run(tx, {}));
    const r = await call(kit.handlers.plan, { run_id: s.run_id });
    expect([r.status, code_of(r)]).toEqual([404, "NOT_FOUND"]);
  });
});
