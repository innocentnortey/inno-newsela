// NL-36 AC-6: reader returns the highest seq, null when empty, and has no write method.
import { FakeClock } from "@ls/core/ports/clock";
import { PrefixedIdGenerator } from "@ls/core/ports/ids";
import { afterAll, beforeAll, describe, expect, expectTypeOf, it } from "vitest";
import { create_test_db, type TestDb } from "../testing/test-db.ts";
import { PgAuditLog } from "./audit.ts";
import { PgLessonDocReader } from "./lesson-doc-reads.ts";
import { PgLessonDocStore } from "./lesson-docs.ts";
import { SqlCheckQueue, SqlLastEditor, as_state_repo, edited, request_for, seed_world } from "./lesson-docs.test-support.ts";

let t: TestDb;
const ids = new PrefixedIdGenerator();
const clock = new FakeClock(new Date("2026-10-03T09:00:00.000Z"));
const U = ids.new_id("usr");

beforeAll(async () => {
  t = await create_test_db({ pool_max: 4 });
  await seed_world(t, U, "G6.U4.L13");
});
afterAll(async () => {
  await t.drop();
});

describe("PgLessonDocReader [AC-6]", () => {
  it("returns null for a lesson with no stored document", async () => {
    const r = new PgLessonDocReader({ db: t.db });
    expect(await r.latest("G6.U4.L99")).toBeNull();
    expect(await r.latest_derived("G6.U4.L99")).toBeNull();
  });

  it("returns the highest seq with bytes, vector and stored_by", async () => {
    const store = new PgLessonDocStore({
      db: t.db, ids, clock, checks: new SqlCheckQueue(), states: as_state_repo(new SqlLastEditor()),
      audit: new PgAuditLog({ db: t.db, ids, clock }),
    });
    const lid = "G6.U4.L13";
    await store.store(request_for({ ...edited(1), lesson_id: lid }, { stored_by: U }));
    const r2 = request_for({ ...edited(2), lesson_id: lid }, { stored_by: null });
    const a2 = await store.store(r2);
    const r = new PgLessonDocReader({ db: t.db });
    const latest = await r.latest(lid);
    expect(latest).toMatchObject({ lesson_id: lid, seq: 2, store_id: a2.store_id, content_hash: r2.content_hash, state_vector: r2.state_vector });
    expect(Buffer.from(latest!.ydoc_bytes).equals(Buffer.from(r2.ydoc_bytes))).toBe(true);
    const d = await r.latest_derived(lid);
    expect(d).toMatchObject({ seq: 2, stored_by: null });
    expect(d!.lesson.title).toBe(edited(2).title);
  });

  it("has no write method", () => {
    expectTypeOf<PgLessonDocReader>().not.toHaveProperty("store");
    expect(Object.getOwnPropertyNames(PgLessonDocReader.prototype).filter((n) => n !== "constructor" && !n.startsWith("newest")).sort()).toEqual(["latest", "latest_derived"]);
  });
});
