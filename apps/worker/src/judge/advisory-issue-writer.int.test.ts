import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { FakeClock } from "@ls/core/ports/clock";
import { PrefixedIdGenerator } from "@ls/core/ports/ids";
import { insert_row } from "../../../../packages/db/src/testing/insert-row.ts";
import { create_test_db, type TestDb } from "../../../../packages/db/src/testing/test-db.ts";
import { PgAdvisoryIssueWriter } from "./advisory-issue-writer.ts";

const H = `sha256:${"a".repeat(64)}`;
const LESSON = "G6.U4.L1";
let t: TestDb;

beforeAll(async () => {
  t = await create_test_db({ pool_max: 4 });
  await t.db.with_tx(async (tx) => {
    await insert_row(tx, "lesson_doc", { lesson_id: LESSON, seq: 1, content_hash: H });
  });
});
afterAll(async () => {
  await t.drop();
});

describe("PgAdvisoryIssueWriter duplicate check", () => {
  it("re-inserts a judge_no after a fix-clear, and skips a live duplicate", async () => {
    const w = new PgAdvisoryIssueWriter({ db: t.db, ids: new PrefixedIdGenerator(), clock: new FakeClock(new Date("2026-10-01T10:00:00Z")) });
    const no = [{ address: "lesson.blocks[1]", code: "RL.6.1", question: "q" }];
    expect(await w.append_advisory(LESSON, H, no)).toBe(1);
    expect(await w.append_advisory(LESSON, H, no)).toBe(0);
    await t.db.with_tx((tx) => tx.query("UPDATE issue SET cleared_by='fix' WHERE lesson_id=$1", [LESSON]));
    expect(await w.append_advisory(LESSON, H, no)).toBe(1);
    const rows = await t.db.with_tx(async (tx) => (await tx.query<{ cleared_by: string | null }>("SELECT cleared_by FROM issue WHERE lesson_id=$1 ORDER BY created_at, id", [LESSON])).rows);
    expect(rows.map((r) => r.cleared_by).sort()).toEqual(["fix", null]);
  });
});
