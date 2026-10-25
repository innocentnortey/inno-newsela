// NL-37
import pg from "pg";
import { FakeClock } from "@ls/core/ports/clock";
import { PrefixedIdGenerator } from "@ls/core/ports/ids";
import type { CheckFinding } from "@ls/core/ports/issues";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { insert_row } from "../testing/insert-row.ts";
import { create_test_db, type TestDb } from "../testing/test-db.ts";
import { PgCheckQueue, unchecked_stores } from "./check-queue.ts";
import { PgIssueRepo } from "./issue-repo.ts";

const H = (c: string): string => `sha256:${c.repeat(64)}`;
const H1 = H("a"), H2 = H("b"), H3 = H("c");
const T0 = new Date("2026-10-01T10:00:00.000Z");
let t: TestDb;
let clock: FakeClock;
let q: PgCheckQueue;
let issues: PgIssueRepo;
const ids = new PrefixedIdGenerator();
let n = 0;
const next_lesson = (): string => `G6.U4.L${++n}`;
const finding: CheckFinding = {
  kind: "quote_placeholder_open", level: "blocking", message: "Quote placeholder is still open.",
  address: "lesson.blocks[3].PartA", span_anchor: null, related_lesson_id: null, code: null,
};
const rows = async (lesson: string, status?: string) =>
  t.db.with_tx(async (tx) =>
    (await tx.query("SELECT * FROM check_job WHERE lesson_id=$1 AND ($2::text IS NULL OR status=$2) ORDER BY id", [lesson, status ?? null])).rows,
  );
const store = (lesson: string, seq: number, hash: string, at: Date = clock.now()) =>
  t.db.with_tx(async (tx) => {
    await insert_row(tx, "lesson_doc", { lesson_id: lesson, seq, store_id: `st_${seq}`, content_hash: hash, stored_at: at.toISOString() });
  });
// claim() takes the oldest job in the database, so claim tests start from an empty queue.
const drain = () => t.db.with_tx(async (tx) => { await tx.query("DELETE FROM check_job"); });
const enq = (lesson: string, hash: string, store_id: string) =>
  t.db.with_tx((tx) => q.enqueue(lesson, hash, store_id, tx));

beforeAll(async () => {
  t = await create_test_db({ pool_max: 6 });
  clock = new FakeClock(T0);
  q = new PgCheckQueue({ db: t.db, ids, clock });
  issues = new PgIssueRepo({ db: t.db, ids, clock });
});
afterAll(async () => {
  await t.drop();
});

describe("PgCheckQueue", () => {
  it("coalesce_to_newest: three enqueues leave one queued row with the newest hash", async () => {
    const l = next_lesson();
    await enq(l, H1, "st_1");
    clock.advance(10);
    await enq(l, H2, "st_2");
    await enq(l, H3, "st_3");
    const r = await rows(l);
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ status: "queued", content_hash: H3, store_id: "st_3" });
    expect(new Date(r[0]!.enqueued_at).getTime()).toBe(T0.getTime());
  });

  it("enqueue_joins_tx_and_notifies: rollback leaves nothing; commit notifies", async () => {
    const l = next_lesson();
    await expect(
      t.db.with_tx(async (tx) => {
        await q.enqueue(l, H1, "st_1", tx);
        throw new Error("boom");
      }),
    ).rejects.toThrow("boom");
    expect(await rows(l)).toHaveLength(0);

    const c = new pg.Client({ connectionString: t.url });
    await c.connect();
    try {
      await c.query("LISTEN check_job");
      const got = new Promise<string>((res, rej) => {
        const timer = setTimeout(() => rej(new Error("no notification")), 2000);
        c.on("notification", (m) => {
          if (m.payload === l) { clearTimeout(timer); res(m.payload); }
        });
      });
      await enq(l, H1, "st_1");
      expect(await got).toBe(l);
    } finally {
      await c.end();
    }
  });

  it("claim_skip_locked_and_lease: concurrent claim gives one winner", async () => {
    await drain();
    const l = next_lesson();
    await enq(l, H1, "st_1");
    const res = await Promise.all([q.claim(60000), q.claim(60000)]);
    const won = res.filter((x) => x !== null && x.lesson_id === l);
    expect(won).toHaveLength(1);
    expect(won[0]!.lease_until.getTime()).toBe(clock.now().getTime() + 60000);
    await q.finish(won[0]!);
  });

  it("claim_skip_locked_and_lease: a lapsed lease is reclaimed, a live one is not", async () => {
    await drain();
    const l2 = next_lesson();
    await enq(l2, H1, "st_1");
    const first = await q.claim(1000);
    expect(first?.lesson_id).toBe(l2);
    clock.advance(500);
    expect((await q.claim(1000))?.lesson_id).not.toBe(l2);
    clock.advance(501);
    expect((await q.claim(1000))?.lesson_id).toBe(l2);
  });

  it("claim_skip_locked_and_lease: finish leaves a newer queued row untouched", async () => {
    await drain();
    const l = next_lesson();
    await enq(l, H1, "st_1");
    const c = await q.claim(60000);
    expect(c?.content_hash).toBe(H1);
    await enq(l, H2, "st_2");
    await q.finish(c!);
    expect((await rows(l, "done"))[0]).toMatchObject({ content_hash: H1 });
    expect((await rows(l, "queued"))[0]).toMatchObject({ content_hash: H2 });
  });

  it("pending_for_states: empty, queued, and checked lessons", async () => {
    const empty = next_lesson();
    expect(await q.pending_for(empty)).toEqual({
      lesson_id: empty, pending: false, newest_queued_hash: null, latest_stored_hash: null, latest_stored_at: null,
    });

    const l = next_lesson();
    await store(l, 1, H1);
    await enq(l, H1, "st_1");
    const s = await q.pending_for(l);
    expect(s).toMatchObject({ pending: true, newest_queued_hash: H1, latest_stored_hash: H1 });
    expect(s.latest_stored_at).toBeInstanceOf(Date);

    // checked: run the job to done with zero findings
    await drain();
    await enq(l, H1, "st_1");
    const c = await q.claim(60000);
    clock.advance(10);
    await q.finish(c!);
    expect(await q.pending_for(l)).toMatchObject({ pending: false, newest_queued_hash: null, latest_stored_hash: H1 });

    // a newer store with no job is still pending (silence is visible)
    await store(l, 2, H2);
    expect((await q.pending_for(l)).pending).toBe(true);
  });

  it("unchecked_stores_listed: only old, unchecked, jobless stores", async () => {
    const old = next_lesson(), fresh = next_lesson(), queued = next_lesson(), checked = next_lesson();
    const base = new Date("2027-01-01T00:00:00.000Z");
    await store(old, 1, H1, base);
    await store(fresh, 1, H1, new Date(base.getTime() + 25_000));
    await store(queued, 1, H1, base);
    await enq(queued, H1, "st_1");
    await store(checked, 1, H1, base);
    await t.db.with_tx(async (tx) => {
      await insert_row(tx, "issue", { id: ids.new_id("iss"), lesson_id: checked, content_hash: H1, level: "advisory", kind: "arc_repeat", message: "m" });
    });
    const now = new Date(base.getTime() + 31_000);
    const got = (await unchecked_stores(t.db, now, 30)).filter((r) => [old, fresh, queued, checked].includes(r.lesson_id));
    expect(got.map((r) => r.lesson_id)).toEqual([old]);
    expect(got[0]).toMatchObject({ content_hash: H1 });
  });

  it("records_for_wf10: store, enqueue, claim, check, finish leaves a complete record", async () => {
    const l = next_lesson();
    await store(l, 1, H1);
    await enq(l, H1, "st_1");
    await t.db.with_tx(async (tx) => { await tx.query("DELETE FROM check_job WHERE lesson_id<>$1", [l]); });
    const c = await q.claim(60000);
    expect(c).toMatchObject({ lesson_id: l, content_hash: H1 });
    const set = await t.db.with_tx((tx) => issues.replace_for_hash(l, H1, [finding], tx));
    clock.advance(5);
    await q.finish(c!);
    const cur = await issues.current(l);
    expect(cur.checked_hash).toBe(H1);
    expect(cur.issues.map((i) => i.issue_id)).toEqual(set.issues.map((i) => i.issue_id));
    expect(await q.pending_for(l)).toMatchObject({ pending: false, latest_stored_hash: H1 });
    const job = (await rows(l, "done"))[0];
    expect(job!.claimed_at).not.toBeNull();
    expect(job!.finished_at).not.toBeNull();
    expect(await unchecked_stores(t.db, new Date(clock.now().getTime() + 3_600_000), 30).then((r) => r.some((x) => x.lesson_id === l))).toBe(false);
  });
});
