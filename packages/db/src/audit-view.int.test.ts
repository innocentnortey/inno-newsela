// NL-08 AC-10: audit_log_v unions review_event and audit_event for one lesson, ordered by time.
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

describe("audit_log_v (AC-10)", () => {
  it("[invariant] returns the review and audit rows of one lesson in time order, without other lessons", async () => {
    await t.db.with_tx(async (tx) => {
      await insert_row(tx, "app_user", { id: "u-ada", name: "Ada Test" });
      await insert_row(tx, "review_event", {
        lesson_id: "L1",
        actor_id: "u-ada",
        from_state: "in_review",
        to_state: "approved",
        content_hash: "h1",
        reason: "looks right",
        at: "2026-10-01T10:00:00Z",
      });
      await insert_row(tx, "audit_event", {
        actor_id: "u-ada",
        action: "standard.confirm",
        target_kind: "lesson",
        target_id: "L1",
        version_hash: "h1",
        reason: "confirmed",
        at: "2026-10-01T11:00:00Z",
      });
      await insert_row(tx, "audit_event", {
        actor_id: "u-ada",
        action: "standard.remove",
        target_kind: "lesson",
        target_id: "M1",
        at: "2026-10-01T10:30:00Z",
      });
    });
    const rows = await t.db.with_tx(
      async (tx) =>
        (
          await tx.query(
            "select * from audit_log_v where lesson_id=$1 order by at",
            ["L1"],
          )
        ).rows,
    );
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      source: "review_event",
      actor_name: "Ada Test",
      action: "lesson.transition",
      from_state: "in_review",
      to_state: "approved",
      version_hash: "h1",
      reason: "looks right",
    });
    expect(rows[1]).toMatchObject({
      source: "audit_event",
      actor_name: "Ada Test",
      action: "standard.confirm",
      from_state: null,
      to_state: null,
      version_hash: "h1",
      reason: "confirmed",
    });
    expect(new Date(rows[0]!["at"]).getTime()).toBeLessThan(
      new Date(rows[1]!["at"]).getTime(),
    );
    expect(rows.some((r) => r["lesson_id"] === "M1")).toBe(false);
  });
});
