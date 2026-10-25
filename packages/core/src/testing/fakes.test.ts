// NL-12
import { describe, expect, it } from "vitest";
import { FakeAuditLog } from "./fake-audit.ts";
import { FakeCollabCommands } from "./fake-collab-commands.ts";
import { FakeJobQueue } from "./fake-job-queue.ts";
import { FakeLessonStateRepo } from "./fake-lesson-state.ts";
import { FakeModelCallLog } from "./fake-model-call-log.ts";
import { FakeSpendLedger } from "./fake-spend.ts";
import { FakeTxRunner } from "./fake-tx.ts";
import { UnscriptedCall } from "./scripted.ts";

describe("scripted fakes", () => {
  it("FakeAuditLog returns queued values once each, records args, then is unscripted", async () => {
    const f = new FakeAuditLog();
    f.script.returns("append", "ae_1", "ae_2");
    const tx = {};
    const e = { actor_id: null, action: "a.b", target_kind: "run", target_id: "run_1", version_hash: null, reason: null, details: {}, request_id: null, store_id: null } as const;
    expect(await f.append(e, tx)).toBe("ae_1");
    expect(await f.append(e, tx)).toBe("ae_2");
    await expect(f.append(e, tx)).rejects.toBeInstanceOf(UnscriptedCall);
    expect(f.script.calls.map((c) => c.method)).toEqual(["append", "append", "append"]);
    expect(f.script.calls[0]?.args[1]).toBe(tx);
  });

  it("FakeJobQueue rejects with a scripted error", async () => {
    const f = new FakeJobQueue();
    f.script.throws("claim", new Error("boom")).returns("claim", null);
    await expect(f.claim("w", 1, 1000)).rejects.toThrow("boom");
    expect(await f.claim("w", 1, 1000)).toBeNull();
  });

  it("FakeSpendLedger, FakeModelCallLog, FakeCollabCommands, FakeLessonStateRepo are unscripted by default", async () => {
    await expect(new FakeSpendLedger().release_for_jobs([])).rejects.toThrow("unscripted call: release_for_jobs");
    await expect(new FakeModelCallLog().mark_lost("job_1")).rejects.toThrow("unscripted call: mark_lost");
    await expect(new FakeCollabCommands().set_mode({ lesson_id: "G6.U4.L1", mode: "read_only", state: "submitted", request_id: "r" })).rejects.toBeInstanceOf(UnscriptedCall);
    await expect(new FakeLessonStateRepo().get("G6.U4.L1")).rejects.toBeInstanceOf(UnscriptedCall);
  });

  it("FakeLessonStateRepo returns scripted rows", async () => {
    const f = new FakeLessonStateRepo();
    f.script.returns("state_of", { lesson_id: "G6.U4.L1", state: "draft", editable: true, reviewer_id: null });
    expect((await f.state_of("G6.U4.L1")).editable).toBe(true);
  });

  it("FakeTxRunner calls fn once, records the lock name, propagates throws", async () => {
    const t = new FakeTxRunner();
    expect(await t.with_tx(async () => 42, "export:G6.U4")).toBe(42);
    await expect(t.with_tx(async () => { throw new Error("x"); })).rejects.toThrow("x");
    expect(t.locks).toEqual(["export:G6.U4", null]);
  });
});
