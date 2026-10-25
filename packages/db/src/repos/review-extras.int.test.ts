// NL-43
/* eslint-disable @typescript-eslint/no-explicit-any -- test fixtures read untyped pg rows and spy on tx.query */
import { InvariantViolation } from "@ls/core/errors";
import { FakeClock } from "@ls/core/ports/clock";
import { PrefixedIdGenerator } from "@ls/core/ports/ids";
import type { AlignmentLinkRow } from "@ls/core/ports/alignment";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { PgDatabase } from "../pool.ts";
import { insert_row } from "../testing/insert-row.ts";
import { create_test_db, type TestDb } from "../testing/test-db.ts";
import { PgAlignmentRepo, PgSafetyFlagRepo, PgSuggestionRepo } from "./review-extras.ts";

let t: TestDb;
let clock: FakeClock;
let flags: PgSafetyFlagRepo;
let align: PgAlignmentRepo;
let sugs: PgSuggestionRepo;
const ids = new PrefixedIdGenerator();
const USER = ids.new_id("usr");
const USER2 = ids.new_id("usr");
const UNIT = "G6.U4";
const L4 = "G6.U4.L4";
const L31 = "G6.U4.L31";
const L5 = "G6.U4.L5";
const A = "a".repeat(64);
const B = "b".repeat(64);
const CODE = "L.6.4.b";

const w = <T>(fn: (tx: any) => Promise<T>): Promise<T> => t.db.with_tx(fn);
const link = (over: Partial<AlignmentLinkRow> = {}): AlignmentLinkRow => ({
  lesson_id: L4, content_hash: A, code: CODE, address: "s1", role: "I", origin: "outline", asserted_by: "generator", confirmed_by: null, ...over,
});
const flag_count = async (): Promise<number> => w(async (tx) => Number((await tx.query("SELECT count(*)::int AS n FROM safety_flag")).rows[0].n));
const doc = (lesson_id: string, seq: number, content_hash: string) => w((tx) => insert_row(tx, "lesson_doc", { lesson_id, seq, content_hash }));

beforeAll(async () => {
  t = await create_test_db();
  clock = new FakeClock(new Date("2026-10-01T10:00:00.000Z"));
  const deps = { db: t.db, ids, clock };
  flags = new PgSafetyFlagRepo(deps);
  align = new PgAlignmentRepo(deps);
  sugs = new PgSuggestionRepo(deps);
  await w(async (tx) => {
    await insert_row(tx, "app_user", { id: USER, name: "Ada Test" });
    await insert_row(tx, "app_user", { id: USER2, name: "Bo Test" });
    for (const id of [L4, L31, L5]) await insert_row(tx, "lesson", { id, unit_id: UNIT });
  });
});
afterAll(async () => {
  await t.drop();
});

describe("review extras", () => {
  it("flag_create_idempotent: a repeat creates nothing and never duplicates", async () => {
    const first = await w((tx) => flags.create_for_lesson(L31, [39, 39], tx));
    expect(first).toHaveLength(1);
    expect(first[0]?.flag_id).toBe(`sf:${L31}:39`);
    expect(await w((tx) => flags.create_for_lesson(L31, [39], tx))).toEqual([]);
    expect(await flags.open_for(L31)).toHaveLength(1);
    expect(await flag_count()).toBe(1);
  });

  it("flag_clear_records_who_note_when", async () => {
    const [f] = await flags.open_for(L31);
    const cleared = await w((tx) => flags.clear(f!.flag_id, USER, "checked with the teacher", tx));
    expect(cleared.status).toBe("cleared");
    const row = await w(async (tx) => (await tx.query("SELECT * FROM safety_flag WHERE id=$1", [f!.flag_id])).rows[0]);
    expect(row.cleared_by).toBe(USER);
    expect(row.note).toBe("checked with the teacher");
    expect((row.cleared_at as Date).toISOString()).toBe(clock.now().toISOString());
    expect(await flags.open_for(L31)).toEqual([]);
  });

  it("flag_clear_refuses_blank_and_double", async () => {
    await w((tx) => flags.create_for_lesson(L5, [3], tx));
    const id = `sf:${L5}:3`;
    for (const note of ["", "   "]) await expect(w((tx) => flags.clear(id, USER, note, tx))).rejects.toBeInstanceOf(InvariantViolation);
    let open = await flags.open_for(L5);
    expect(open[0]?.cleared_by).toBeNull();
    await w((tx) => flags.clear(id, USER, "first", tx));
    await expect(w((tx) => flags.clear(id, USER2, "second", tx))).rejects.toBeInstanceOf(InvariantViolation);
    const row = await w(async (tx) => (await tx.query("SELECT note, cleared_by FROM safety_flag WHERE id=$1", [id])).rows[0]);
    expect(row).toEqual({ note: "first", cleared_by: USER });
    open = await flags.open_for(L5);
    expect(open).toEqual([]);
  });

  it("alignment_replace_carries_confirmation", async () => {
    await doc(L4, 1, A);
    await doc(L31, 1, A);
    const l1 = link({ address: "s1" });
    const l2 = link({ address: "s2", code: "L.6.4.c" });
    expect(await w((tx) => align.replace_for_hash(L4, A, [l1, l2], tx))).toBe(2);
    await w((tx) => align.replace_for_hash(L31, A, [link({ lesson_id: L31, address: "s9" })], tx));
    await w((tx) => align.confirm(L4, CODE, USER, "confirm", tx));
    await doc(L4, 2, B);
    const n = await w((tx) => align.replace_for_hash(L4, B, [link({ content_hash: B, address: "s1" }), link({ content_hash: B, address: "s2", code: "L.6.4.c" })], tx));
    expect(n).toBe(2);
    await doc(L4, 3, "c".repeat(64));
    // changed address: confirmation dropped
    const C = "c".repeat(64);
    await w((tx) => align.replace_for_hash(L4, C, [link({ content_hash: C, address: "s1-moved" })], tx));
    const rows = await w(async (tx) => (await tx.query("SELECT * FROM alignment_link WHERE lesson_id=$1 ORDER BY content_hash, code, address", [L4])).rows);
    const at = (h: string, code: string) => rows.filter((r: any) => r.content_hash === h && r.code === code);
    expect(at(B, CODE)[0].confirmed_by).toBe(USER);
    expect(at(B, "L.6.4.c")[0].confirmed_by).toBeNull();
    expect(at(C, CODE)[0].confirmed_by).toBeNull();
    expect(at(A, CODE)[0].confirmed_by).toBe(USER);
    expect(at(A, "L.6.4.c")).toHaveLength(1);
    const other = await w(async (tx) => (await tx.query("SELECT * FROM alignment_link WHERE lesson_id=$1", [L31])).rows);
    expect(other).toHaveLength(1);
  });

  it("alignment_confirm_remove_add", async () => {
    const lesson = "G6.U4.L40";
    await w((tx) => insert_row(tx, "lesson", { id: lesson, unit_id: "G6.U9" }));
    await doc(lesson, 1, A);
    const mk = (over: Partial<AlignmentLinkRow>) => link({ lesson_id: lesson, ...over });
    await w((tx) => align.replace_for_hash(lesson, A, [mk({ address: "s1" }), mk({ address: "s2", asserted_by: "judge" }), mk({ code: "L.6.4.c", address: "s3" })], tx));
    const confirmed = await w((tx) => align.confirm(lesson, CODE, USER, "confirm", tx));
    expect(confirmed.confirmed_by).toBe(USER);
    expect(confirmed.asserted_by).toBe("generator");
    // repeat confirm is a no-op, not an error
    expect((await w((tx) => align.confirm(lesson, CODE, USER2, "confirm", tx))).confirmed_by).toBe(USER);
    const removed = await w((tx) => align.confirm(lesson, CODE, USER, "remove", tx));
    expect(removed.address).toBe("s1");
    const left = await align.for_lesson(lesson);
    expect(left.map((r) => r.code)).toEqual(["L.6.4.c"]);
    const added = await w((tx) => align.confirm(lesson, CODE, USER, "add", tx));
    expect(added).toMatchObject({ address: lesson, role: "P", origin: "added", asserted_by: "reviewer", confirmed_by: null });
    await expect(w((tx) => align.confirm(lesson, "L.9.9.z", USER, "confirm", tx))).rejects.toBeInstanceOf(InvariantViolation);
    await expect(w((tx) => align.confirm(lesson, "L.9.9.z", USER, "remove", tx))).rejects.toBeInstanceOf(InvariantViolation);
  });

  it("coverage_rows_one_query: reads the approved snapshot, one statement", async () => {
    const unit = "G7.U1";
    const P = "G7.U1.L1";
    const Q = "G7.U1.L2";
    await w(async (tx) => {
      await insert_row(tx, "lesson", { id: P, unit_id: unit });
      await insert_row(tx, "lesson", { id: Q, unit_id: unit });
      await insert_row(tx, "lesson_version", { id: ids.new_id("lv"), lesson_id: P, number: 1, kind: "approve", content_hash: A });
    });
    await doc(P, 1, A);
    await doc(P, 2, B);
    await doc(Q, 1, B);
    const mk = (lesson_id: string, content_hash: string, o: Partial<AlignmentLinkRow>) => link({ lesson_id, content_hash, ...o });
    await w(async (tx) => {
      await align.replace_for_hash(P, A, [
        mk(P, A, { code: "c1", asserted_by: "judge" }),
        mk(P, A, { code: "c2", address: "x", asserted_by: "generator" }),
        mk(P, A, { code: "c3", address: "y", asserted_by: "reviewer", role: "A" }),
      ], tx);
      await align.replace_for_hash(P, B, [mk(P, B, { code: "cX", asserted_by: "reviewer" })], tx);
      await align.replace_for_hash(Q, B, [mk(Q, B, { code: "c1", asserted_by: "outline", role: "P" })], tx);
    });
    const counts: Array<() => number> = [];
    const spy = {
      with_tx: (fn: (tx: any) => Promise<unknown>) =>
        t.db.with_tx((tx) => {
          const q = tx.query.bind(tx);
          let n = 0;
          (tx as any).query = (...a: [string, unknown[]?]) => { n++; return q(...a); };
          counts.push(() => n);
          return fn(tx);
        }),
    };
    const repo = new PgAlignmentRepo({ db: spy as unknown as PgDatabase, ids, clock });
    const cells = await repo.coverage_rows(unit);
    expect(counts.map((c) => c())).toEqual([1]);
    expect(cells).toEqual([
      { code: "c1", lesson_id: P, role: "I", source: "approved", confirmation: "judge_only" },
      { code: "c1", lesson_id: Q, role: "P", source: "working", confirmation: "generator_only" },
      { code: "c2", lesson_id: P, role: "I", source: "approved", confirmation: "generator_only" },
      { code: "c3", lesson_id: P, role: "A", source: "approved", confirmation: "person" },
    ]);
  });

  const new_sug = (lesson_id: string, expires_at: Date) => ({
    lesson_id, anchor_start: "a", anchor_end: "b", selected_text: "synthetic selected text", note: "n", suggested_text: "synthetic suggestion",
    requested_by: USER, model_call_id: ids.new_id("mc"), expires_at,
  });

  it("suggestion_expiry_and_single_decision", async () => {
    const s = await sugs.insert(new_sug(L4, new Date(clock.now().getTime() + 30 * 60_000)));
    expect(s.status).toBe("pending");
    clock.advance(29 * 60_000);
    expect((await sugs.pending_for(L4, clock.now())).map((x) => x.suggestion_id)).toEqual([s.suggestion_id]);
    clock.advance(2 * 60_000);
    expect(await sugs.pending_for(L4, clock.now())).toEqual([]);
    expect((await sugs.get(s.suggestion_id))?.status).toBe("closed");
    expect(await sugs.get(ids.new_id("sug"))).toBeNull();

    const s2 = await sugs.insert(new_sug(L4, new Date(clock.now().getTime() + 30 * 60_000)));
    const done = await w((tx) => sugs.decide(s2.suggestion_id, "accepted", USER, tx));
    expect(done.status).toBe("accepted");
    await expect(w((tx) => sugs.decide(s2.suggestion_id, "rejected", USER2, tx))).rejects.toBeInstanceOf(InvariantViolation);
    const again = await sugs.get(s2.suggestion_id);
    expect(again).toMatchObject({ status: "accepted", decided_by: USER });

    await expect(w((tx) => sugs.decide(s.suggestion_id, "accepted", USER, tx))).rejects.toBeInstanceOf(InvariantViolation);
    expect((await w((tx) => sugs.decide(s.suggestion_id, "closed", USER, tx))).status).toBe("closed");
  });

  it("writes_name_the_person", async () => {
    await w((tx) => flags.create_for_lesson("G6.U4.L50", [1], tx));
    const f = await w((tx) => flags.clear(`sf:G6.U4.L50:1`, USER, "ok", tx));
    expect(f.cleared_by).toBe(USER);
    expect(f.cleared_at).toBeInstanceOf(Date);
    const lesson = "G6.U4.L51";
    await w((tx) => insert_row(tx, "lesson", { id: lesson, unit_id: UNIT }));
    await doc(lesson, 1, A);
    await w((tx) => align.replace_for_hash(lesson, A, [link({ lesson_id: lesson })], tx));
    expect((await w((tx) => align.confirm(lesson, CODE, USER, "confirm", tx))).confirmed_by).toBe(USER);
    const s = await sugs.insert(new_sug(lesson, new Date(clock.now().getTime() + 60_000)));
    expect(s.requested_by).toBe(USER);
    const d = await w((tx) => sugs.decide(s.suggestion_id, "rejected", USER2, tx));
    expect(d.decided_by).toBe(USER2);
    expect(d.decided_at).toBeInstanceOf(Date);
  });

  it("restore_undoes_decision", async () => {
    const lesson = "G6.U4.L60";
    await w((tx) => insert_row(tx, "lesson", { id: lesson, unit_id: UNIT }));
    await doc(lesson, 1, A);
    await w((tx) => align.replace_for_hash(lesson, A, [link({ lesson_id: lesson }), link({ lesson_id: lesson, address: "s2" }), link({ lesson_id: lesson, code: "L.6.4.c", address: "s3" })], tx));
    const all = await align.for_lesson(lesson);
    const snap = all.filter((r) => r.code === CODE);
    const others = all.filter((r) => r.code !== CODE);
    await w((tx) => align.confirm(lesson, CODE, USER, "confirm", tx));
    expect(await w((tx) => align.restore(lesson, CODE, snap, tx))).toBe(2);
    expect(await align.for_lesson(lesson)).toEqual(all);
    await w((tx) => align.confirm(lesson, CODE, USER, "remove", tx));
    expect((await align.for_lesson(lesson)).filter((r) => r.code === CODE)).toEqual([]);
    await w((tx) => align.restore(lesson, CODE, snap, tx));
    expect(await align.for_lesson(lesson)).toEqual(all);
    expect((await align.for_lesson(lesson)).filter((r) => r.code !== CODE)).toEqual(others);
    // undo of an add: empty restore is valid
    await w((tx) => align.confirm(lesson, "L.new", USER, "add", tx));
    expect(await w((tx) => align.restore(lesson, "L.new", [], tx))).toBe(0);
  });
});
