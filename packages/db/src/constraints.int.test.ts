// NL-08 AC-5 [invariant] storage constraints (CON-5, CON-16, HP-7 mechanic 3, coalescing, one metrics row per lesson).
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { create_test_db, type TestDb } from "./testing/test-db.ts";
import { insert_row } from "./testing/insert-row.ts";

let t: TestDb;
beforeAll(async () => {
  t = await create_test_db();
});
afterAll(async () => {
  await t.drop();
});

const ins = (table: string, row: Record<string, unknown>) => t.db.with_tx((tx) => insert_row(tx, table, row));
const unique_violation = (constraint: string) => ({ code: "23505", constraint });

describe("constraints (AC-5)", () => {
  it("[invariant] a second queued check_job for one lesson is rejected (check_job_one_queued)", async () => {
    await ins("check_job", { lesson_id: "L-chk", status: "queued" });
    await expect(ins("check_job", { lesson_id: "L-chk", status: "queued" })).rejects.toMatchObject(
      unique_violation("check_job_one_queued"),
    );
  });

  it("[invariant] a second in-flight candidate lesson_job for one lesson is rejected (lesson_job_one_candidate)", async () => {
    await ins("lesson_job", { lesson_id: "L-cand", kind: "candidate", status: "queued" });
    await expect(ins("lesson_job", { lesson_id: "L-cand", kind: "candidate", status: "running" })).rejects.toMatchObject(
      unique_violation("lesson_job_one_candidate"),
    );
  });

  it("[invariant] a queued candidate and a finished one coexist", async () => {
    await ins("lesson_job", { lesson_id: "L-coexist", kind: "candidate", status: "done" });
    await ins("lesson_job", { lesson_id: "L-coexist", kind: "candidate", status: "queued" });
    const n = await t.db.with_tx(async (tx) => (await tx.query("select 1 from lesson_job where lesson_id='L-coexist'")).rows.length);
    expect(n).toBe(2);
  });

  it("[invariant] a duplicate lesson_version.idempotency_key is rejected", async () => {
    await ins("lesson_version", { lesson_id: "L-v1", idempotency_key: "idem-1" });
    await expect(ins("lesson_version", { lesson_id: "L-v2", idempotency_key: "idem-1" })).rejects.toMatchObject(
      unique_violation("lesson_version_idempotency_key_key"),
    );
  });

  it("[invariant] a duplicate lower(email) is rejected (app_user_email_lower)", async () => {
    await ins("app_user", { email: "Ada@Example.test" });
    await expect(ins("app_user", { email: "ada@example.TEST" })).rejects.toMatchObject(unique_violation("app_user_email_lower"));
  });

  it("[invariant] a second lesson_metrics row for one lesson is rejected (lesson_metrics_pkey)", async () => {
    await ins("lesson_metrics", { lesson_id: "L-m" });
    await expect(ins("lesson_metrics", { lesson_id: "L-m" })).rejects.toMatchObject(unique_violation("lesson_metrics_pkey"));
  });

  it("[invariant] a duplicate (started_by, idempotency_key) run is rejected (run_started_by_idempotency_key_key)", async () => {
    await ins("run", { started_by: "u1", idempotency_key: "k1" });
    await expect(ins("run", { started_by: "u1", idempotency_key: "k1" })).rejects.toMatchObject(
      unique_violation("run_started_by_idempotency_key_key"),
    );
    // a different user may reuse the key
    await ins("run", { started_by: "u2", idempotency_key: "k1" });
  });
});
