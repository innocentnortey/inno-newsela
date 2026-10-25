// NL-36 frozen tests: AC-1 (store_one_transaction), AC-2 (store_rolls_back_whole_unit),
// AC-4 (seed_initial_joins_tx_and_is_idempotent). Needs the test Postgres: scripts/test-db.sh up.
import { FakeClock } from "@ls/core/ports/clock";
import { PrefixedIdGenerator } from "@ls/core/ports/ids";
import { InvariantViolation } from "@ls/core/errors";
import { content_hash, state_vector_of } from "@ls/ydoc/hash";
import { lesson_to_ydoc } from "@ls/ydoc/convert";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { create_test_db, type TestDb } from "../testing/test-db.ts";
import { PgAuditLog } from "./audit.ts";
import { PgLessonDocStore } from "./lesson-docs.ts";
import {
  FailingAudit, FailingCheckQueue, SYSTEM_ACTOR, SqlCheckQueue, SqlLastEditor, WP1_LESSON_ID, as_state_repo,
  edited, request_for, rows, scalar, seed_world, wp1,
} from "./lesson-docs.test-support.ts";

let t: TestDb;
const ids = new PrefixedIdGenerator();
const clock = new FakeClock(new Date("2026-10-01T10:00:00.000Z"));
const USER = ids.new_id("usr");

const make = (over: Partial<ConstructorParameters<typeof PgLessonDocStore>[0]> = {}) => {
  const audit = new PgAuditLog({ db: t.db, ids, clock });
  return new PgLessonDocStore({
    db: t.db, ids, clock, checks: new SqlCheckQueue(), states: as_state_repo(new SqlLastEditor()), audit, ...over,
  });
};
const n = async (table: string, lesson_col: string, lesson_id: string) =>
  Number(await scalar(t, `SELECT count(*)::int FROM ${table} WHERE ${lesson_col}=$1`, [lesson_id]));

beforeAll(async () => {
  t = await create_test_db({ pool_max: 6 });
  await seed_world(t, USER);
});
afterAll(async () => {
  await t.drop();
});

describe("store_one_transaction [invariant, AC-1]", () => {
  it("writes lesson_doc (seq previous+1), one check_job, last editor and one audit row, and acks", async () => {
    const store = make();
    const l1 = edited(1);
    const l2 = edited(2);
    clock.advance(1000);
    const r1 = request_for(l1, { stored_by: USER, request_id: "req-one", tag: "slot-fill" });
    const ack1 = await store.store(r1);
    clock.advance(1000);
    const r2 = request_for(l2, { stored_by: USER, request_id: "req-two", tag: null });
    const ack2 = await store.store(r2);

    expect(ack1.seq).toBe(1);
    expect(ack2.seq).toBe(2);
    expect(ack2).toMatchObject({
      lesson_id: WP1_LESSON_ID, content_hash: r2.content_hash, state_vector: r2.state_vector,
      stored_by: USER, check_job_enqueued: true,
    });
    expect(ack2.store_id).toMatch(/^st_[0-9A-HJKMNP-TV-Z]{26}$/);
    expect(ack2.stored_at).toBeInstanceOf(Date);
    expect(ack2.stored_at.toISOString()).toBe(clock.now().toISOString());

    const docs = await rows(t, "SELECT * FROM lesson_doc WHERE lesson_id=$1 ORDER BY seq", [WP1_LESSON_ID]);
    expect(docs.map((d) => d["seq"])).toEqual([1, 2]);
    const d2 = docs[1]!;
    expect(d2["store_id"]).toBe(ack2.store_id);
    expect(Buffer.from(d2["ydoc_bytes"] as Buffer).equals(Buffer.from(r2.ydoc_bytes))).toBe(true);
    expect(d2["derived_json"]).toEqual(JSON.parse(JSON.stringify(l2)));
    expect(d2["content_hash"]).toBe(r2.content_hash);
    expect((d2["state_vector"] as Buffer).toString("base64")).toBe(r2.state_vector);
    expect(d2["schema_version"]).toBe(l2.schema_version);
    expect(d2["stored_by"]).toBe(USER);
    expect(d2["request_id"]).toBe("req-two");
    expect((d2["stored_at"] as Date).toISOString()).toBe(clock.now().toISOString());

    // check_job: coalesced to one queued row carrying the newest hash and store id
    const jobs = await rows(t, "SELECT * FROM check_job WHERE lesson_id=$1", [WP1_LESSON_ID]);
    expect(jobs).toHaveLength(1);
    expect(jobs[0]).toMatchObject({ content_hash: r2.content_hash, store_id: ack2.store_id, status: "queued" });

    expect(await scalar(t, "SELECT last_editor_id FROM lesson WHERE id=$1", [WP1_LESSON_ID])).toBe(USER);

    const audits = await rows(t, "SELECT * FROM audit_event WHERE target_id=$1 AND action='lesson.store' ORDER BY at, id", [WP1_LESSON_ID]);
    expect(audits).toHaveLength(2);
    const a2 = audits.find((a) => a["store_id"] === ack2.store_id)!;
    expect(a2).toMatchObject({ request_id: "req-two", target_kind: "lesson", version_hash: r2.content_hash, actor_id: USER });
    expect(a2["details_json"]).toMatchObject({ seq: 2, tag: null });
  });

  it("[boundary] a system store (stored_by null) leaves last_editor_id alone and stores a null stored_by", async () => {
    const store = make();
    await seed_world(t, USER, "G6.U4.L6");
    const lesson = { ...edited(9), lesson_id: "G6.U4.L6" };
    const ack = await store.store(request_for(lesson, { stored_by: null, request_id: null }));
    expect(ack.stored_by).toBeNull();
    expect(ack.check_job_enqueued).toBe(true);
    expect(await scalar(t, "SELECT last_editor_id FROM lesson WHERE id=$1", ["G6.U4.L6"])).toBeNull();
    expect(await scalar(t, "SELECT stored_by FROM lesson_doc WHERE lesson_id=$1", ["G6.U4.L6"])).toBeNull();
  });
});

describe("store_rolls_back_whole_unit [failure/refusal, AC-2]", () => {
  const baseline = async () => ({
    docs: await n("lesson_doc", "lesson_id", WP1_LESSON_ID),
    jobs: await n("check_job", "lesson_id", WP1_LESSON_ID),
    audits: Number(await scalar(t, "SELECT count(*)::int FROM audit_event WHERE target_id=$1", [WP1_LESSON_ID])),
    editor: await scalar(t, "SELECT last_editor_id FROM lesson WHERE id=$1", [WP1_LESSON_ID]),
  });
  const FRESH_USER = ids.new_id("usr");

  it("a failure in checks.enqueue leaves no lesson_doc, no check_job, no last-editor change", async () => {
    await seed_world(t, FRESH_USER, "G6.U4.L7");
    const before = {
      docs: await n("lesson_doc", "lesson_id", "G6.U4.L7"),
      jobs: await n("check_job", "lesson_id", "G6.U4.L7"),
      editor: await scalar(t, "SELECT last_editor_id FROM lesson WHERE id=$1", ["G6.U4.L7"]),
    };
    const store = make({ checks: new FailingCheckQueue() });
    await expect(store.store(request_for({ ...edited(20), lesson_id: "G6.U4.L7" }, { stored_by: USER }))).rejects.toThrow("forced enqueue failure");
    expect(await n("lesson_doc", "lesson_id", "G6.U4.L7")).toBe(before.docs);
    expect(await n("check_job", "lesson_id", "G6.U4.L7")).toBe(before.jobs);
    expect(await scalar(t, "SELECT last_editor_id FROM lesson WHERE id=$1", ["G6.U4.L7"])).toBe(before.editor);
    expect(before.docs).toBe(0);
  });

  it("a failure in audit.append (last step) rolls back lesson_doc, check_job and the last-editor change", async () => {
    await seed_world(t, FRESH_USER);
    const before = await baseline();
    const store = make({ audit: new FailingAudit(new PgAuditLog({ db: t.db, ids, clock })) });
    await expect(store.store(request_for(edited(21), { stored_by: FRESH_USER }))).rejects.toThrow("forced audit failure");
    expect(await baseline()).toEqual(before);
  });
});

describe("seed_initial_joins_tx_and_is_idempotent [invariant, AC-4]", () => {
  const LID = "G6.U4.L8";
  const counts = async () => ({
    docs: await n("lesson_doc", "lesson_id", LID),
    jobs: await n("check_job", "lesson_id", LID),
    audits: Number(await scalar(t, "SELECT count(*)::int FROM audit_event WHERE target_id=$1", [LID])),
  });
  const lesson = () => ({ ...wp1(), lesson_id: LID });

  it("with the caller rolling back, no lesson_doc or check_job row remains", async () => {
    const store = make();
    await expect(
      t.db.with_tx(async (tx) => {
        const r = await store.seed_initial(LID, lesson(), SYSTEM_ACTOR, tx);
        expect(r.seeded).toBe(true);
        throw new Error("caller aborts");
      }),
    ).rejects.toThrow("caller aborts");
    expect(await counts()).toEqual({ docs: 0, jobs: 0, audits: 0 });
  });

  it("committed: seq 1 exists with the lesson's hash and the bytes' state vector; no audit row", async () => {
    const store = make();
    const l = lesson();
    const res = await t.db.with_tx((tx) => store.seed_initial(LID, l, SYSTEM_ACTOR, tx));
    expect(res.seeded).toBe(true);
    expect(res.store_id).toMatch(/^st_/);
    expect(res.content_hash).toBe(content_hash(l));
    const docs = await rows(t, "SELECT * FROM lesson_doc WHERE lesson_id=$1", [LID]);
    expect(docs).toHaveLength(1);
    expect(docs[0]).toMatchObject({ seq: 1, store_id: res.store_id, content_hash: content_hash(l) });
    const bytes = new Uint8Array(docs[0]!["ydoc_bytes"] as Buffer);
    expect((docs[0]!["state_vector"] as Buffer).toString("base64")).toBe(state_vector_of(bytes));
    expect(bytes.length).toBeGreaterThan(0);
    expect(lesson_to_ydoc(l).length).toBeGreaterThan(0);
    const jobs = await rows(t, "SELECT * FROM check_job WHERE lesson_id=$1", [LID]);
    expect(jobs).toHaveLength(1);
    expect(jobs[0]).toMatchObject({ content_hash: content_hash(l), store_id: res.store_id });
    expect((await counts()).audits).toBe(0);
  });

  it("a second call returns seeded false, store_id null, writes and enqueues nothing", async () => {
    const store = make();
    const before = await counts();
    const res = await t.db.with_tx((tx) => store.seed_initial(LID, lesson(), SYSTEM_ACTOR, tx));
    expect(res).toMatchObject({ lesson_id: LID, seeded: false, store_id: null, content_hash: content_hash(lesson()) });
    expect(await counts()).toEqual(before);
    expect(before).toEqual({ docs: 1, jobs: 1, audits: 0 });
  });

  it("[boundary] refuses a lesson whose id differs from the target id before any SQL", async () => {
    const store = make();
    await expect(
      t.db.with_tx((tx) => store.seed_initial("G6.U4.L9", lesson(), SYSTEM_ACTOR, tx)),
    ).rejects.toBeInstanceOf(InvariantViolation);
    expect(await n("lesson_doc", "lesson_id", "G6.U4.L9")).toBe(0);
  });
});
