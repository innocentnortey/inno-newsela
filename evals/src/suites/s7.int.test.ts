// NL-84
import { FakeClock } from "@ls/core/ports/clock";
import { PrefixedIdGenerator } from "@ls/core/ports/ids";
import { PgSafetyFlagRepo } from "@ls/db/repos/review-extras";
import { insert_row } from "@ls/db/testing/insert-row";
import { create_test_db, type TestDb } from "@ls/db/testing/test-db";
import { afterAll, describe, expect, it } from "vitest";

let t: TestDb;
afterAll(async () => {
  await t.drop();
});

describe("S7 clear record on Postgres", () => {
  it("cleared_flags_carry_user_note_time_in_pg", async () => {
    t = await create_test_db();
    const ids = new PrefixedIdGenerator();
    const user = ids.new_id("usr");
    const clock = new FakeClock(new Date("2026-10-25T12:00:00.000Z"));
    const flags = new PgSafetyFlagRepo({ db: t.db, ids, clock });
    await t.db.with_tx(async (tx) => {
      await insert_row(tx, "app_user", { id: user, name: "Ada Test" });
      await insert_row(tx, "lesson", { id: "G6.U4.L31", unit_id: "G6.U4" });
    });
    const [created] = await t.db.with_tx((tx) => flags.create_for_lesson("G6.U4.L31", [39], tx));
    expect(created).toMatchObject({ status: "open", cleared_by: null, cleared_at: null });
    await t.db.with_tx((tx) => flags.clear(created!.flag_id, user, "reviewed", tx));
    const row = await t.db.with_tx(async (tx) => (await tx.query<Record<string, unknown>>("SELECT * FROM safety_flag WHERE id=$1", [created!.flag_id])).rows[0]);
    expect(row?.["status"]).toBe("cleared");
    expect(row?.["cleared_by"]).toBe(user);
    expect(row?.["note"]).toBe("reviewed");
    expect(row?.["cleared_at"]).toBeInstanceOf(Date);
  });
});
