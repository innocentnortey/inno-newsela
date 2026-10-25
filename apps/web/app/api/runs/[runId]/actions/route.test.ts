// @vitest-environment node
// NL-78: controlRun against a real test database.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { insert_row } from "@ls/db/testing/insert-row";
import { create_test_db, type TestDb } from "@ls/db/testing/test-db";
import { body_of, call, code_of, count, make_run_kit, seed_lessons, seed_stub_run, set_job, type RunKit } from "@/server/services/testing/run-read-harness";

let t: TestDb;
let kit: RunKit;
const q = <T>(fn: (tx: Parameters<typeof seed_lessons>[0]) => Promise<T>): Promise<T> => t.db.with_tx(async (tx) => fn(tx));
const act = (run_id: string, action: string, token = "author-token") => call(kit.handlers.actions, { run_id, token, method: "POST", body: { action } });
const rows = async (sql: string, v: unknown[] = []) => (await q((tx) => tx.query(sql, v))).rows;

beforeAll(async () => {
  t = await create_test_db({ pool_max: 6 });
  kit = make_run_kit(t);
  await q((tx) => seed_lessons(tx, 3));
});
afterAll(async () => {
  await t.drop();
});

describe("controlRun", () => {
  it("cancel_semantics", async () => {
    const s = await q((tx) => seed_stub_run(tx, { statuses: ["running", "queued", "queued"] }));
    const lessons_before = await q((tx) => count(tx, "lesson"));
    const res = await act(s.run_id, "cancel");
    expect(res.status).toBe(200);
    expect(body_of(res)).toMatchObject({ run_id: s.run_id, state: "cancelled", requeued_lessons: [] });
    const jobs = await rows("SELECT id, status, tile_state FROM lesson_job WHERE run_id = $1 AND kind = 'lesson' ORDER BY id", [s.run_id]);
    const by = Object.fromEntries(jobs.map((j) => [j["id"], j]));
    expect(by[s.jobs[0]!]).toMatchObject({ status: "running", tile_state: "drafting" });
    for (const id of s.jobs.slice(1)) expect(by[id]).toMatchObject({ status: "cancelled", tile_state: "failed" });
    expect(await q((tx) => count(tx, "lesson"))).toBe(lessons_before);
    const audit = await rows("SELECT action, request_id FROM audit_event WHERE target_id = $1", [s.run_id]);
    expect(audit).toEqual([{ action: "run.cancel", request_id: res.headers["X-Request-Id"] }]);
  });

  it("test_run_control_capture", async () => {
    const s = await q((tx) => seed_stub_run(tx, { state: "partial", statuses: ["generation_failed", "generation_failed", "ready"] }));
    await q(async (tx) => {
      await set_job(tx, s.jobs[0]!, { failure_reasons_json: JSON.stringify([{ check: "timeout", message: "m" }]) });
      await insert_row(tx, "lesson_version", { id: "lv_nl78", lesson_id: s.lesson_ids[2], number: 1, kind: "draft", content_hash: "hash-nl78-known" });
    });
    const hash = async () => (await rows("SELECT content_hash FROM lesson_version WHERE lesson_id = $1", [s.lesson_ids[2]]))[0]?.["content_hash"];
    const res = await act(s.run_id, "retry_failed");
    expect(res.status).toBe(200);
    const b = body_of(res);
    expect(b.state).toBe("running");
    expect([...b.requeued_lessons].sort()).toEqual([s.lesson_ids[0], s.lesson_ids[1]].sort());
    const jobs = await rows("SELECT id, status, tile_state, failure_reasons_json r FROM lesson_job WHERE run_id = $1 AND kind = 'lesson'", [s.run_id]);
    for (const j of jobs) {
      if (j["id"] === s.jobs[2]) expect(j["status"]).toBe("ready");
      else expect(j).toMatchObject({ status: "queued", tile_state: "queued", r: [] });
    }
    expect(await hash()).toBe("hash-nl78-known");
    expect((await rows("SELECT state FROM run WHERE id = $1", [s.run_id]))[0]).toEqual({ state: "running" });
    expect((await rows("SELECT action FROM audit_event WHERE target_id = $1", [s.run_id])).map((r) => r["action"])).toEqual(["run.retry_failed"]);
    expect(kit.notified.filter((x) => x === s.run_id)).toHaveLength(1);
  });

  it("resume of a failed unit plan re-queues the plan job and wakes the workers", async () => {
    const s = await q((tx) => seed_stub_run(tx, { state: "paused", paused_check: "unit_plan", plan_stored_at: null, statuses: ["queued", "queued", "queued"] }));
    await q((tx) => set_job(tx, s.plan_job, { status: "generation_failed", tile_state: "failed" }));
    const res = await act(s.run_id, "resume");
    expect(res.status).toBe(200);
    expect(body_of(res)).toMatchObject({ state: "running", requeued_lessons: [] });
    expect((await rows("SELECT status FROM lesson_job WHERE id = $1", [s.plan_job]))[0]).toEqual({ status: "queued" });
    expect((await rows("SELECT paused_check FROM run WHERE id = $1", [s.run_id]))[0]).toEqual({ paused_check: null });
    expect(kit.notified.filter((x) => x === s.run_id)).toHaveLength(1);
  });

  it("invalid_transitions_and_role", async () => {
    const pairs: Array<[string, string]> = [
      ["running", "resume"], ["complete", "retry_failed"], ["partial", "resume"], ["planning", "retry_failed"],
      ...["cancel", "retry_failed", "resume"].flatMap((a): Array<[string, string]> => [["cancelled", a], ["capped", a]]),
    ];
    const seeded = await q(async (tx) => {
      const out: Array<{ run_id: string; state: string; action: string }> = [];
      for (const [state, action] of pairs) out.push({ run_id: (await seed_stub_run(tx, { state, statuses: ["queued", "generation_failed", "ready"] })).run_id, state, action });
      return out;
    });
    const snapshot = async () => ({
      runs: await rows("SELECT id, state FROM run ORDER BY id"),
      jobs: await rows("SELECT id, status FROM lesson_job ORDER BY id"),
      audit: await q((tx) => count(tx, "audit_event")),
    });
    const before = await snapshot();
    const refused_before = () => kit.lines.map((l) => JSON.parse(l) as { event: string }).filter((l) => l.event === "route.refused").length;
    let refusals = refused_before();
    for (const s of seeded) {
      const r = await act(s.run_id, s.action);
      expect([r.status, code_of(r), (r.body as any).error.details.state]).toEqual([409, "INVALID_TRANSITION", s.state]);
      expect(refused_before()).toBe(++refusals);
    }
    const reviewer = await act(seeded[0]!.run_id, "cancel", "reviewer-token");
    expect([reviewer.status, code_of(reviewer)]).toEqual([403, "ROLE_FORBIDDEN"]);
    expect(refused_before()).toBe(++refusals);
    const missing = await act("run_missing", "cancel");
    expect([missing.status, code_of(missing)]).toEqual([404, "NOT_FOUND"]);
    refusals += 1;
    const bad = await act(seeded[0]!.run_id, "raise_cap");
    expect([bad.status, code_of(bad)]).toEqual([400, "INVALID_REQUEST"]);
    expect(refused_before()).toBe(refusals + 1);
    expect(await snapshot()).toEqual(before);
  });

  it("row_lock_double_click", async () => {
    const s = await q((tx) => seed_stub_run(tx, { state: "paused", paused_check: "circuit_breaker", statuses: ["queued", "queued", "queued"] }));
    const res = await Promise.all([act(s.run_id, "resume"), act(s.run_id, "resume")]);
    expect(res.map((r) => r.status).sort()).toEqual([200, 409]);
    expect(code_of(res.find((r) => r.status === 409)!)).toBe("INVALID_TRANSITION");
    expect((await rows("SELECT state FROM run WHERE id = $1", [s.run_id]))[0]).toEqual({ state: "running" });
    expect(await q((tx) => count(tx, "audit_event", "target_id = $1", [s.run_id]))).toBe(1);
  });
});
