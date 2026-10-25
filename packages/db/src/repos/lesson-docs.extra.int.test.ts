// NL-36 AC-3 (seq_unique_under_concurrency), AC-5 (round_trip_hash_identity), AC-12 (records_for_wf9).
import { FakeClock } from "@ls/core/ports/clock";
import { PrefixedIdGenerator } from "@ls/core/ports/ids";
import { ydoc_to_lesson } from "@ls/ydoc/convert";
import { content_hash } from "@ls/ydoc/hash";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { create_test_db, type TestDb } from "../testing/test-db.ts";
import { PgAuditLog } from "./audit.ts";
import { PgLessonDocStore } from "./lesson-docs.ts";
import { PgLessonDocReader } from "./lesson-doc-reads.ts";
import { SqlCheckQueue, SqlLastEditor, as_state_repo, edited, request_for, rows, scalar, seed_world, wp1 } from "./lesson-docs.test-support.ts";

let t: TestDb;
const ids = new PrefixedIdGenerator();
const clock = new FakeClock(new Date("2026-10-02T09:00:00.000Z"));
const U1 = ids.new_id("usr");
const U2 = ids.new_id("usr");

const make = () =>
  new PgLessonDocStore({
    db: t.db, ids, clock, checks: new SqlCheckQueue(), states: as_state_repo(new SqlLastEditor()),
    audit: new PgAuditLog({ db: t.db, ids, clock }),
  });

beforeAll(async () => {
  t = await create_test_db({ pool_max: 10 });
  await seed_world(t, U1);
  await seed_world(t, U2);
});
afterAll(async () => {
  await t.drop();
});

describe("seq_unique_under_concurrency [invariant, AC-3]", () => {
  it("8 concurrent stores give seq 1..8; a system store leaves the last editor alone", async () => {
    const store = make();
    const lid = "G6.U4.L10";
    await seed_world(t, U1, lid);
    const acks = await Promise.all(
      Array.from({ length: 8 }, (_, i) =>
        store.store(request_for({ ...edited(i), lesson_id: lid }, { stored_by: i === 7 ? null : U1 })),
      ),
    );
    expect(acks.map((a) => a.seq).sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    const seqs = (await rows(t, "SELECT seq FROM lesson_doc WHERE lesson_id=$1 ORDER BY seq", [lid])).map((r) => r["seq"]);
    expect(seqs).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(await scalar(t, "SELECT last_editor_id FROM lesson WHERE id=$1", [lid])).toBe(U1);
  });
});

describe("round_trip_hash_identity [invariant, AC-5]", () => {
  it("original, latest_derived and ydoc_to_lesson(latest bytes) hash the same", async () => {
    const store = make();
    const reader = new PgLessonDocReader({ db: t.db });
    const lid = "G6.U4.L11";
    await seed_world(t, U1, lid);
    const lesson = { ...wp1(), lesson_id: lid };
    await store.store(request_for(lesson, { stored_by: U1 }));
    const derived = await reader.latest_derived(lid);
    const latest = await reader.latest(lid);
    const h = content_hash(lesson);
    expect(derived!.content_hash).toBe(h);
    expect(content_hash(derived!.lesson)).toBe(h);
    expect(content_hash(ydoc_to_lesson(latest!.ydoc_bytes, latest!.schema_version))).toBe(h);
  });
});

describe("records_for_wf9 [capture, AC-12]", () => {
  it("two editors: one row per store with hash, vector, stored_at; a check_job for the newest hash; audit rows carry store_id", async () => {
    const store = make();
    const lid = "G6.U4.L12";
    await seed_world(t, U1, lid);
    const a1 = await store.store(request_for({ ...edited(30), lesson_id: lid }, { stored_by: U1, request_id: "r1" }));
    clock.advance(500);
    const r2 = request_for({ ...edited(31), lesson_id: lid }, { stored_by: U2, request_id: "r2" });
    const a2 = await store.store(r2);
    const docs = await rows(t, "SELECT seq, store_id, content_hash, state_vector, stored_at, stored_by FROM lesson_doc WHERE lesson_id=$1 ORDER BY seq", [lid]);
    expect(docs).toHaveLength(2);
    for (const d of docs) {
      expect(d["content_hash"]).toMatch(/^[0-9a-f]{64}$/);
      expect((d["state_vector"] as Buffer).length).toBeGreaterThan(0);
      expect(d["stored_at"]).toBeInstanceOf(Date);
    }
    expect(docs.map((d) => d["stored_by"])).toEqual([U1, U2]);
    const jobs = await rows(t, "SELECT content_hash, store_id FROM check_job WHERE lesson_id=$1", [lid]);
    expect(jobs).toEqual([{ content_hash: r2.content_hash, store_id: a2.store_id }]);
    const audits = await rows(t, "SELECT store_id FROM audit_event WHERE target_id=$1 AND action='lesson.store'", [lid]);
    expect(audits.map((a) => a["store_id"]).sort()).toEqual([a1.store_id, a2.store_id].sort());
    expect(await scalar(t, "SELECT last_editor_id FROM lesson WHERE id=$1", [lid])).toBe(U2);
  });
});
