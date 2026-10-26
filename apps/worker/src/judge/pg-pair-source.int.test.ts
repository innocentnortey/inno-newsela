import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { LessonId, Sha256 } from "@ls/core/ports/common";
import type { LessonDocReader } from "@ls/core/ports/lesson-docs";
import type { StandardRepo } from "@ls/core/ports/standards";
import { insert_row } from "../../../../packages/db/src/testing/insert-row.ts";
import { create_test_db, type TestDb } from "../../../../packages/db/src/testing/test-db.ts";
import { PgJudgePairSource } from "./pg-pair-source.ts";

const H = `sha256:${"b".repeat(64)}` as Sha256;
const LESSON = "G6.U4.L2" as LessonId;
const ADDRESS = "G6.U4.L2.Launch";
let t: TestDb;

beforeAll(async () => {
  t = await create_test_db({ pool_max: 4 });
  await t.db.with_tx(async (tx) => {
    // Migration 0016 keys alignment_link on role: one code may be Introduced and Practised at the same address.
    for (const role of ["I", "P"]) {
      await insert_row(tx, "alignment_link", { lesson_id: LESSON, content_hash: H, code: "RL.6.1", address: ADDRESS, role });
    }
    await insert_row(tx, "alignment_link", { lesson_id: LESSON, content_hash: H, code: "RL.6.2", address: ADDRESS, role: "P" });
    await insert_row(tx, "alignment_link", { lesson_id: LESSON, content_hash: H, code: "RL.6.3", address: ADDRESS, role: "C" });
  });
});
afterAll(async () => {
  await t.drop();
});

describe("PgJudgePairSource", () => {
  it("one judge pair per code and address, even when the code is both Introduced and Practised there", async () => {
    const reader = {
      latest_derived: async () => ({
        content_hash: H,
        lesson: { sections: [{ address: ADDRESS, content: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Students read." }] }] } }] },
      }),
    } as unknown as LessonDocReader;
    const standards = {
      texts: async (codes: readonly string[]) => codes.map((code) => ({ code, text: `text of ${code}` })),
    } as unknown as StandardRepo;
    const src = new PgJudgePairSource({ db: t.db, reader, standards });
    const ctx = await src.load(LESSON, H);
    expect(ctx.pairs.map((p) => `${p.code}@${p.address}`)).toEqual([`RL.6.1@${ADDRESS}`, `RL.6.2@${ADDRESS}`]);
  });
});
