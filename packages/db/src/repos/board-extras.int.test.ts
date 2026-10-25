// NL-54
import { FakeClock } from "@ls/core/ports/clock";
import { PrefixedIdGenerator } from "@ls/core/ports/ids";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { insert_row } from "../testing/insert-row.ts";
import { create_test_db, type TestDb } from "../testing/test-db.ts";
import { PgBoardExtrasRepo } from "./board-extras.ts";

let t: TestDb;
let repo: PgBoardExtrasRepo;
const ids = new PrefixedIdGenerator();
const USER = ids.new_id("usr");
const UNIT = "G6.U4";
const SENT = "G6.U4.L1";
const DONE = "G6.U4.L2";

const w = <T>(fn: (tx: any) => Promise<T>): Promise<T> => t.db.with_tx(fn);
const ev = (lesson_id: string, to_state: string, at: string, over: Record<string, unknown> = {}) =>
  w((tx) => insert_row(tx, "review_event", { id: ids.new_id("ev"), lesson_id, from_state: "submitted", to_state, actor_id: USER, at, ...over }));

beforeAll(async () => {
  t = await create_test_db();
  repo = new PgBoardExtrasRepo({ db: t.db, ids, clock: new FakeClock(new Date("2026-10-01T10:00:00.000Z")) });
  await w(async (tx) => {
    await insert_row(tx, "app_user", { id: USER, name: "Ada Test" });
    await insert_row(tx, "unit", { id: UNIT });
    await insert_row(tx, "lesson", { id: SENT, unit_id: UNIT, state: "changes_requested" });
    await insert_row(tx, "lesson", { id: DONE, unit_id: UNIT, state: "approved" });
  });
});
afterAll(async () => {
  await t.drop();
});

describe("board extras", () => {
  it("unit_exists_true_false", async () => {
    expect(await repo.unit_exists(UNIT as any)).toBe(true);
    expect(await repo.unit_exists("G9.U9" as any)).toBe(false);
    expect(await repo.unit_extras("G9.U9" as any)).toBeNull();
  });

  it("latest_send_back_only_while_changes_requested", async () => {
    await ev(SENT, "changes_requested", "2026-10-01T10:00:00Z", { reason_tag: "standards", note: "first" });
    await ev(SENT, "changes_requested", "2026-10-02T10:00:00Z", { reason_tag: "eld_support", note: "second" });
    await ev(DONE, "changes_requested", "2026-10-01T10:00:00Z", { reason_tag: "other", note: "old" });
    const x = await repo.unit_extras(UNIT as any);
    expect(x?.send_backs).toHaveLength(1);
    expect(x?.send_backs[0]).toMatchObject({ lesson_id: SENT, tag: "eld_support", note: "second", by: "Ada Test" });
  });

  it("no_minutes_columns", async () => {
    const x = await repo.unit_extras(UNIT as any);
    for (const s of x?.send_backs ?? []) expect(Object.keys(s).filter((k) => /minutes|seconds|user_id/.test(k))).toEqual([]);
  });
});
