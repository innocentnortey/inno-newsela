// NL-27: RunService.start against in-memory doubles. Synthetic data only.
import { createHash } from "node:crypto";
import Decimal from "decimal.js";
import { SCHEMA_VERSION } from "@ls/editor-schema/schema";
import type { RequestUser } from "@ls/core/ports/common";
import { FakeSpendLedger } from "@ls/core/testing/fake-spend";
import type { StartRunRequest } from "@ls/schema/api/runs";
import { describe, expect, it } from "vitest";
import { build_outline, job_row, make_service, OUTLINE_VERSION_ID, PROMPT_VERSION_ID } from "./testing/run-service-fakes.ts";

const user = (role: RequestUser["role"] = "author", id = "usr_synthetic_author"): RequestUser =>
  ({ user_id: id, name: "T", email: "t@example.test", role, synthetic: true, request_id: "req_1" }) as unknown as RequestUser;
const request = (over: Partial<StartRunRequest> = {}): StartRunRequest =>
  ({ outline_version_id: OUTLINE_VERSION_ID, mode: "run", scope: { kind: "all" }, prompt_version_id: PROMPT_VERSION_ID, cap_usd: 13, ...over }) as StartRunRequest;
const sha = (...p: string[]) => createHash("sha256").update(p.join("\n")).digest("hex");
const refusal = async (p: Promise<unknown>) => p.then(() => null, (e: unknown) => e as { code: string; details: unknown });

describe("RunService.start", () => {
  it("full_run_creates_jobs: one run, a plan job and 47 lesson jobs in one transaction", async () => {
    const k = make_service();
    const run = await k.service.start(user(), request(), null);
    expect(run.state).toBe("planning");
    expect(run.spent_usd).toBe(0);
    expect(run.cap_usd).toBe(13);
    expect(run.mode).toBe("run");
    expect(k.runs.inserted).toHaveLength(1);
    expect(k.queue.created).toHaveLength(48);
    expect(k.queue.created.filter((j) => j.kind === "unit_plan")).toHaveLength(1);
    expect(k.queue.created.filter((j) => j.kind === "lesson")).toHaveLength(47);
    for (const j of k.queue.created) {
      expect(j.run_id).toBe(run.run_id);
      expect(j.idempotency_key).toBe(sha(run.run_id, j.lesson_id ?? "unit_plan", PROMPT_VERSION_ID, String(SCHEMA_VERSION)));
    }
    expect(k.audit.appended.map((a) => a.action)).toEqual(["run.start"]);
    expect(k.states.ensured[0]?.rows).toHaveLength(47);
    expect(k.tx.locks).toHaveLength(1);
  });

  it("scope_rows_and_trial: rows [8,9,25] and a one-lesson trial", async () => {
    const k = make_service();
    await k.service.start(user(), request({ scope: { kind: "rows", rows: [25, 8, 9] } }), null);
    expect(k.queue.created.map((j) => [j.kind, j.lesson_id])).toEqual([
      ["unit_plan", null], ["lesson", "G6.U4.L7"], ["lesson", "G6.U4.L8"], ["lesson", "G6.U4.FLEX-1a"],
    ]);
    expect(k.runs.inserted[0]?.scope_rows).toEqual([8, 9, 25]);

    const t = make_service();
    const run = await t.service.start(user(), request({ mode: "trial", lesson_id: "G6.U4.L3" }), null);
    expect(run.mode).toBe("trial");
    expect(t.runs.inserted[0]?.kind).toBe("trial");
    expect(t.queue.created).toHaveLength(1);
    expect(t.queue.created[0]).toMatchObject({ kind: "candidate", lesson_id: "G6.U4.L3" });
  });

  it("unfinished_of_run: only the unfinished lessons get jobs; the old run is untouched", async () => {
    const k = make_service();
    const first = await k.service.start(user(), request(), null);
    const lessons = build_outline().rows.filter((r) => r.lesson_id !== null).map((r) => r.lesson_id as string);
    k.queue.by_run.set(first.run_id, lessons.map((id, i) => job_row(first.run_id, id, i < 40 ? "ready" : "cancelled", i)));
    const old_before = { ...k.runs.rows.get(first.run_id) };
    k.queue.created.length = 0;

    const run = await k.service.start(user(), request({ scope: { kind: "unfinished_of_run", run_id: first.run_id }, cap_usd: 4 }), null);
    expect(k.queue.created.filter((j) => j.kind === "lesson").map((j) => j.lesson_id)).toEqual(lessons.slice(40));
    expect(k.queue.created.filter((j) => j.kind === "unit_plan")).toHaveLength(1);
    expect(k.runs.inserted[1]?.parent_run_id).toBe(first.run_id);
    expect(run.cap_usd).toBe(4);
    expect(k.runs.rows.get(first.run_id)).toEqual(old_before);

    expect((await refusal(k.service.start(user(), request({ scope: { kind: "unfinished_of_run", run_id: "run_nope" } }), null)))?.code).toBe("NOT_FOUND");
    const other = k.runs.rows.get(first.run_id);
    if (other) k.runs.rows.set("run_other", { ...other, run_id: "run_other", outline_version_id: "G6.U4.ov9" });
    expect((await refusal(k.service.start(user(), request({ scope: { kind: "unfinished_of_run", run_id: "run_other" } }), null)))?.code).toBe("INVALID_REQUEST");
  });

  it("validation_incomplete: refused with the count; nothing written", async () => {
    const k = make_service({ outline: build_outline({ errors_unconfirmed: true }) });
    const e = await refusal(k.service.start(user(), request(), null));
    expect(e?.code).toBe("VALIDATION_INCOMPLETE");
    expect(e?.details).toEqual({ errors_unconfirmed: 1 });
    expect([k.runs.inserted.length, k.queue.created.length, k.audit.appended.length, k.states.ensured.length]).toEqual([0, 0, 0, 0]);
  });

  it("day_cap_scopes: user then project, with the remaining amount; nothing written", async () => {
    const k = make_service();
    const spend = new FakeSpendLedger();
    const refused = (refused_by: "day_cap" | "project_cap", scope: "user" | "project", n: number) =>
      ({ allowed: false, reservation_id: null, refused_by, scope, remaining_usd: new Decimal(n), snapshot: {} }) as never;
    spend.script.returns("check_day_cap", refused("day_cap", "user", 2), refused("project_cap", "project", 5));
    (k.service as unknown as { spend: FakeSpendLedger }).spend = spend;
    const a = await refusal(k.service.start(user(), request(), null));
    const b = await refusal(k.service.start(user(), request(), null));
    expect([a?.code, a?.details]).toEqual(["DAY_CAP_REACHED", { scope: "user", remaining_usd: 2 }]);
    expect([b?.code, b?.details]).toEqual(["DAY_CAP_REACHED", { scope: "project", remaining_usd: 5 }]);
    expect([k.runs.inserted.length, k.queue.created.length, k.audit.appended.length]).toEqual([0, 0, 0]);
  });

  it("idempotent_replay: same key returns the first run, expires after 24 h, is per user", async () => {
    const k = make_service();
    const first = await k.service.start(user(), request(), "k1");
    const again = await k.service.start(user(), request(), " k1 ");
    expect(again.run_id).toBe(first.run_id);
    expect(k.runs.inserted).toHaveLength(1);
    expect(k.queue.created).toHaveLength(48);
    expect(k.tx.locks[0]).toBe("run:start:usr_synthetic_authork1");
    // A retry with a different body still returns the ORIGINAL run, scope included.
    const changed = await k.service.start(user(), request({ scope: { kind: "rows", rows: [2] }, cap_usd: 1 }), "k1");
    expect(changed.run_id).toBe(first.run_id);
    expect(changed.scope).toEqual(first.scope);
    expect(changed.cap_usd).toBe(first.cap_usd);
    expect(k.runs.inserted).toHaveLength(1);
    const other = await k.service.start(user("author", "usr_other"), request(), "k1");
    expect(other.run_id).not.toBe(first.run_id);
    k.clock.advance(25 * 3_600_000);
    const late = await k.service.start(user(), request(), "k1");
    expect(late.run_id).not.toBe(first.run_id);
    expect(k.runs.inserted).toHaveLength(3);
  });

  it("invalid_requests: field-level refusals, NOT_FOUND, ROLE_FORBIDDEN", async () => {
    const k = make_service();
    const code = async (r: StartRunRequest, u = user()) => (await refusal(k.service.start(u, r, null)))?.code;
    expect(await code(request({ mode: "trial" }))).toBe("INVALID_REQUEST");
    expect(await code(request({ cap_usd: 0 }))).toBe("INVALID_REQUEST");
    expect(await code(request({ scope: { kind: "rows", rows: [999] } }))).toBe("INVALID_REQUEST");
    expect(await code(request({ scope: { kind: "rows", rows: [1] } }))).toBe("INVALID_REQUEST"); // arc header
    expect(await code(request({ outline_version_id: "G6.U4.ov7" }))).toBe("NOT_FOUND");
    expect(await code(request({ prompt_version_id: "pv_none" }))).toBe("NOT_FOUND");
    expect(await code(request(), user("reviewer"))).toBe("ROLE_FORBIDDEN");
    const e = await refusal(k.service.start(user(), request({ mode: "trial" }), null));
    expect(e?.details).toEqual({ fields: ["lesson_id"] });
    expect(k.runs.inserted).toHaveLength(0);
  });
});
