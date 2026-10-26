// @vitest-environment node
// GEN-3 review: V-1 (first-pass clean rate) ignores blocking issues cleared by a fix, like every other read path.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { insert_row } from "@ls/db/testing/insert-row";
import { create_test_db, type TestDb } from "@ls/db/testing/test-db";
import { PgUnitQualityReader } from "./unit-quality.ts";

const H = `sha256:${"a".repeat(64)}`;
const UNIT = "unit_q1";
let t: TestDb;

beforeAll(async () => {
  t = await create_test_db({ pool_max: 4 });
  await t.db.with_tx(async (tx) => {
    await insert_row(tx, "unit", { id: UNIT });
    await insert_row(tx, "lesson", { id: "G6.U4.L1", unit_id: UNIT });
    await insert_row(tx, "lesson_version", { lesson_id: "G6.U4.L1", number: 1, kind: "generated", content_hash: H });
    await insert_row(tx, "issue", { lesson_id: "G6.U4.L1", content_hash: H, level: "blocking", kind: "safety_flag_open", cleared_by: "fix" });
  });
});
afterAll(async () => {
  await t.drop();
});

describe("PgUnitQualityReader V-1", () => {
  it("counts a version whose only blocking issue was cleared by a fix as clean", async () => {
    const q = await new PgUnitQualityReader(t.db).read(UNIT);
    expect(q.tiles.find((x) => x.id === "V-1")).toMatchObject({ value: 100, n: 1 });
  });
  it("still counts an uncleared blocking issue as not clean", async () => {
    await t.db.with_tx((tx) => tx.query("UPDATE issue SET cleared_by = NULL"));
    const q = await new PgUnitQualityReader(t.db).read(UNIT);
    expect(q.tiles.find((x) => x.id === "V-1")).toMatchObject({ value: 0, n: 1 });
  });
});
