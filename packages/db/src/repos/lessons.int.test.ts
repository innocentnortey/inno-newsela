// NL-42
import Decimal from "decimal.js";
import { FakeClock } from "@ls/core/ports/clock";
import { PrefixedIdGenerator } from "@ls/core/ports/ids";
import { DomainRefusal, InvariantViolation } from "@ls/core/errors";
import type { ProvenanceRecord } from "@ls/core/ports/lesson-versions";
import type { LessonStateName } from "@ls/core/ports/common";
import type { StoredLesson } from "@ls/schema/lesson";
import type { LessonDraft } from "@ls/schema/lesson-draft";
import type { NormalizedRow } from "@ls/schema/outline";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { insert_row } from "../testing/insert-row.ts";
import { create_test_db, type TestDb } from "../testing/test-db.ts";
import { PgLessonRepo } from "./lessons.ts";

let t: TestDb;
let repo: PgLessonRepo;
const ids = new PrefixedIdGenerator();
const clock = new FakeClock(new Date("2026-10-01T10:00:00.000Z"));
const USER = ids.new_id("usr");
const HASH = "a".repeat(64);
const SV = Buffer.from([1, 2, 3, 4]).toString("base64");

const lesson_row = (id: string, n: number): NormalizedRow =>
  ({ kind: "lesson", lesson_id: id, number: n, title: `Title ${n}`, lesson_type: "core" }) as unknown as NormalizedRow;
const other_row = (kind: string): NormalizedRow =>
  ({ kind, lesson_id: null, number: null, title: kind, lesson_type: "" }) as unknown as NormalizedRow;

const stored = (text = "alpha beta gamma"): StoredLesson =>
  ({
    sections: [
      { address: "a", name: "Open", minutes: 5, content: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text }] }] } },
    ],
  }) as unknown as StoredLesson;

const prov = (run_id: string | null): ProvenanceRecord => ({
  outline_row_hash: HASH, prompt_version_id: "pv1", model: "m", parameters: {}, schema_version: 1,
  example_set_id: null, run_id: run_id as never, model_call_ids: [], cost_usd: new Decimal("0.5"),
  ai_assisted_spans: 0, derived_from_version_id: null,
});

let key = 0;
const gen = (lesson_id: string, unit_id: string, kind: "generated" | "candidate" = "generated", run_id: string | null = null, idem = `k${++key}`) =>
  t.db.with_tx((tx) =>
    repo.write_generated_version(
      { lesson_id, unit_id, kind, lesson: stored(), draft: {} as LessonDraft, content_hash: HASH, provenance: prov(run_id), idempotency_key: idem },
      tx,
    ),
  );
const snap = (lesson_id: string, kind: "submit" | "approve" | "reopen", hash = HASH) =>
  t.db.with_tx((tx) =>
    repo.write_snapshot({ lesson_id, kind, lesson: stored(), content_hash: hash, state_vector: SV, dependency_record: [], created_by: USER }, tx),
  );
const seed = (unit: string, ...nums: number[]) =>
  t.db.with_tx((tx) => repo.ensure_lessons(nums.map((n) => lesson_row(`${unit}.L${n}`, n)), unit, tx));
const set_state = (id: string, s: LessonStateName) => t.db.with_tx((tx) => repo.set_state(id, s, null, tx));
const q = async (sql: string, values: unknown[] = []) => t.db.with_tx(async (tx) => (await tx.query(sql, values)).rows);

beforeAll(async () => {
  t = await create_test_db();
  repo = new PgLessonRepo({ db: t.db, ids, clock });
});
afterAll(async () => {
  await t.drop();
});

describe("PgLessonRepo", () => {
  it("ensure_lessons_idempotent: 47 then 0, non-lesson rows skipped", async () => {
    const rows = Array.from({ length: 47 }, (_, i) => lesson_row(`G6.U4.L${i + 1}`, i + 1));
    const all = [...rows, other_row("flex_day"), other_row("arc_header"), other_row("total")];
    expect(await t.db.with_tx((tx) => repo.ensure_lessons(all, "G6.U4", tx))).toBe(47);
    const before = await q("SELECT * FROM lesson WHERE unit_id='G6.U4' ORDER BY id");
    expect(before).toHaveLength(47);
    expect(before.every((r) => r["state"] === "draft")).toBe(true);
    expect(await t.db.with_tx((tx) => repo.ensure_lessons(all, "G6.U4", tx))).toBe(0);
    expect(await q("SELECT * FROM lesson WHERE unit_id='G6.U4' ORDER BY id")).toEqual(before);
  });

  it("ensure_lessons_flex_day_with_lesson_id: a flex day that carries a lesson id gets a draft lesson row", async () => {
    const flex = { kind: "flex_day", lesson_id: "G6.U5.L9", number: 9, title: "Flex", lesson_type: "Flex Day" } as unknown as NormalizedRow;
    expect(await t.db.with_tx((tx) => repo.ensure_lessons([flex], "G6.U5", tx))).toBe(1);
    expect((await q("SELECT state FROM lesson WHERE id='G6.U5.L9'"))[0]?.["state"]).toBe("draft");
  });

  it("get returns reviewer_name and last_editor_name from app_user", async () => {
    await t.db.with_tx(async (tx) => {
      await insert_row(tx, "app_user", { id: "usr_names_1", name: "J. Rivera" });
      await tx.query("UPDATE lesson SET reviewer_id='usr_names_1', last_editor_id='usr_names_1' WHERE id='G6.U4.L2'");
    });
    expect(await repo.get("G6.U4.L2")).toMatchObject({ reviewer_id: "usr_names_1", reviewer_name: "J. Rivera", last_editor_name: "J. Rivera" });
    expect(await repo.get("G6.U4.L3")).toMatchObject({ reviewer_name: null, last_editor_name: null });
  });

  it("lock_for_update_serializes", async () => {
    const id = "G6.U4.L1";
    let locked!: () => void;
    const locked_p = new Promise<void>((r) => (locked = r));
    const a = t.db.with_tx(async (tx) => {
      await repo.lock_for_update(id, tx);
      locked();
      await new Promise((r) => setTimeout(r, 300));
      await repo.set_state(id, "in_review", null, tx);
    });
    await locked_p;
    const b = await t.db.with_tx((tx) => repo.lock_for_update(id, tx));
    await a;
    expect(b.state).toBe("in_review");
    await expect(t.db.with_tx((tx) => repo.lock_for_update("G6.U4.L999", tx))).rejects.toBeInstanceOf(DomainRefusal);
  });

  it("review_event_append_only", async () => {
    const e = {
      lesson_id: "G6.U4.L2", version_id: "lv_x", from_state: "draft" as const, to_state: "in_review" as const, actor_id: USER,
      reason: "r", reason_tag: "tag", note: "n", content_hash: HASH, request_id: ids.new_id("req"),
    };
    const out = await t.db.with_tx((tx) => repo.append_review_event(e, tx));
    expect(out.review_event_id).toMatch(/^ev_/);
    const rows = await q("SELECT * FROM review_event WHERE id=$1", [out.review_event_id]);
    expect(rows).toHaveLength(1);
    const r = rows[0]!;
    expect({ ...r, at: undefined, id: undefined }).toEqual({ ...e, at: undefined, id: undefined });
    expect((r["at"] as Date).toISOString()).toBe(clock.now().toISOString());
    await expect(q("UPDATE review_event SET note='x'")).rejects.toThrow(/append-only/);
    await expect(q("DELETE FROM review_event")).rejects.toThrow(/append-only/);
  });

  it("generated_version_idempotent", async () => {
    await seed("G6.U5", 1);
    const id = "G6.U5.L1";
    const first = await gen(id, "G6.U5", "generated", null, "idem-gen-1");
    expect(first.created).toBe(true);
    expect(first.version.number).toBe(1);
    expect(first.version.provenance.cost_usd.toString()).toBe("0.5");
    expect((await repo.get(id))?.current_version_id).toBe(first.version.version_id);
    const again = await gen(id, "G6.U5", "generated", null, "idem-gen-1");
    expect(again.created).toBe(false);
    expect(again.version.version_id).toBe(first.version.version_id);
    expect(await q("SELECT 1 FROM lesson_version WHERE lesson_id=$1", [id])).toHaveLength(1);
    expect(await repo.has_generated_version(id)).toBe(true);
  });

  it("candidate_does_not_replace_current", async () => {
    await seed("G6.U6", 1);
    const id = "G6.U6.L1";
    const g = await gen(id, "G6.U6");
    const c = await gen(id, "G6.U6", "candidate");
    expect(c.version.number).toBe(2);
    expect(c.version.adopted).toBe(false);
    expect((await repo.get(id))?.current_version_id).toBe(g.version.version_id);
  });

  it("snapshot_inherits_provenance", async () => {
    await seed("G6.U7", 1);
    const id = "G6.U7.L1";
    const run = ids.new_id("run");
    const g = await gen(id, "G6.U7", "generated", run);
    const s = await snap(id, "submit");
    expect(s.number).toBe(2);
    expect(s.provenance.run_id).toBe(run);
    expect(s.provenance.outline_row_hash).toBe(HASH);
    expect(s.provenance.prompt_version_id).toBe("pv1");
    expect(s.provenance.model).toBeNull();
    expect(s.provenance.cost_usd.toString()).toBe("0");
    expect(s.provenance.derived_from_version_id).toBe(g.version.version_id);
    expect(s.state_vector).toBe(SV);
    expect(s.teacher_word_count).toBe(3);
    expect((await repo.get(id))?.current_version_id).toBe(g.version.version_id);
    // an adopted candidate becomes the newest source
    const c = await gen(id, "G6.U7", "candidate", run);
    await t.db.with_tx((tx) => repo.mark_adopted(c.version.version_id, tx));
    const s2 = await snap(id, "approve");
    expect(s2.provenance.derived_from_version_id).toBe(c.version.version_id);
    expect((await repo.latest_snapshot(id))?.version_id).toBe(s2.version_id);
  });

  it("snapshot_refuses_bad_input_writes_nothing", async () => {
    await seed("G6.U8", 1, 2);
    await gen("G6.U8.L1", "G6.U8");
    const n = async () => (await q("SELECT 1 FROM lesson_version")).length;
    const before = await n();
    await expect(snap("G6.U8.L1", "generated" as never)).rejects.toBeInstanceOf(InvariantViolation);
    await expect(snap("G6.U4.L99", "submit")).rejects.toBeInstanceOf(InvariantViolation);
    await expect(snap("G6.U8.L2", "submit")).rejects.toBeInstanceOf(InvariantViolation);
    expect(await n()).toBe(before);
    expect((await snap("G6.U8.L1", "submit")).number).toBe(2);
  });

  it("reads_by_id_and_latest", async () => {
    await seed("G6.U9", 1, 2);
    const id = "G6.U9.L1";
    const g = await gen(id, "G6.U9");
    const c = await gen(id, "G6.U9", "candidate");
    await snap(id, "submit");
    const s2 = await snap(id, "reopen");
    expect((await repo.version(g.version.version_id))?.kind).toBe("generated");
    expect(await repo.version("lv_nope")).toBeNull();
    expect((await repo.latest_snapshot(id))?.version_id).toBe(s2.version_id);
    expect(await repo.latest_snapshot("G6.U9.L2")).toBeNull();
    expect((await repo.candidate(id, c.version.version_id))?.version_id).toBe(c.version.version_id);
    expect((await repo.candidate(id, g.version.version_id))?.version_id).toBe(g.version.version_id); // S-37: a generated v1 is readable as a candidate
    expect(await repo.candidate(id, "ver_missing")).toBeNull();
    expect(await repo.candidate("G6.U9.L2", c.version.version_id)).toBeNull();
    expect(await repo.has_generated_version("G6.U9.L2")).toBe(false);
  });

  it("approved_snapshots_only", async () => {
    const unit = "G6.U10";
    await seed(unit, 1, 2, 3, 4, 5);
    const states: Record<number, LessonStateName> = { 1: "approved", 2: "exported", 3: "in_review", 4: "submitted", 5: "reopened" };
    for (const n of [1, 2, 3, 4, 5]) {
      const id = `${unit}.L${n}`;
      await gen(id, unit);
      await snap(id, "submit");
      await snap(id, "approve", n === 1 ? "b".repeat(64) : HASH);
      if (n === 1) await snap(id, "approve", "c".repeat(64));
      if (n === 5) await snap(id, "reopen");
      await set_state(id, states[n]!);
    }
    const out = await repo.approved_snapshots(unit);
    expect(out.map((v) => v.lesson_id)).toEqual([`${unit}.L1`, `${unit}.L2`]);
    expect(out[0]!.content_hash).toBe("c".repeat(64));
    expect(out.every((v) => v.kind === "approve")).toBe(true);
  });

  it("dependencies_wp1", async () => {
    const unit = "G6.U11";
    await seed(unit, 4, 5);
    const l4 = `${unit}.L4`, l5 = `${unit}.L5`;
    await t.db.with_tx(async (tx) => {
      await insert_row(tx, "outline_version", { id: `${unit}.ov1`, unit_id: unit, number: 1 });
      await insert_row(tx, "lesson_link", {
        outline_version_id: `${unit}.ov1`, from_lesson_id: l4, to_lesson_id: l5, kind: "excerpt_slot", slot_id: "L5.excerpt_1",
      });
    });
    const w0 = await repo.dependencies(l4);
    expect(w0).toEqual([
      { direction: "waits_on", lesson_id: l5, slot_id: "L5.excerpt_1", source_state: "draft", slot_filled: false, source_approved_hash: null },
    ]);

    const derived = {
      sections: [{ content: { type: "doc", content: [{ type: "excerpt_slot", attrs: { slot_id: "L5.excerpt_1", rights: "cleared", source_ref: "src-1" } }] } }],
    };
    await t.db.with_tx(async (tx) => {
      await insert_row(tx, "lesson_doc", { lesson_id: l5, seq: 1, derived_json: JSON.stringify(derived) });
    });
    await gen(l5, unit);
    const ap = await snap(l5, "approve", "d".repeat(64));
    await set_state(l5, "approved");

    const w1 = await repo.dependencies(l4);
    expect(w1[0]).toMatchObject({ slot_filled: true, source_state: "approved", source_approved_hash: ap.content_hash });
    expect(await repo.dependants(l5)).toEqual([l4]);
    expect(await repo.dependants(l4)).toEqual([]);
    const d5 = await repo.dependencies(l5);
    expect(d5).toHaveLength(1);
    expect(d5[0]).toMatchObject({ direction: "depended_on_by", lesson_id: l4, slot_id: "L5.excerpt_1" });
  });

  it("dependencies_ordinal_slot_id: a link naming .excerpt-N finds the document's own slot id", async () => {
    const unit = "G6.U13";
    await seed(unit, 4, 5);
    const l4 = `${unit}.L4`, l5 = `${unit}.L5`;
    await t.db.with_tx(async (tx) => {
      await insert_row(tx, "outline_version", { id: `${unit}.ov1`, unit_id: unit, number: 1 });
      await insert_row(tx, "lesson_link", {
        outline_version_id: `${unit}.ov1`, from_lesson_id: l4, to_lesson_id: l5, kind: "excerpt_slot", slot_id: `${l5}.excerpt-1`,
      });
    });
    const put = async (seq: number, rights: string) => {
      const derived = {
        sections: [{ content: { type: "doc", content: [{ type: "excerpt_slot", attrs: { slot_id: "hare-lion", rights, source_ref: "Synthetic Reader" } }] } }],
      };
      await t.db.with_tx(async (tx) => {
        await insert_row(tx, "lesson_doc", { lesson_id: l5, seq, derived_json: JSON.stringify(derived) });
      });
    };
    await put(1, "unset");
    expect((await repo.dependencies(l4))[0]!.slot_filled).toBe(false);
    await put(2, "public-domain");
    expect((await repo.dependencies(l4))[0]!.slot_filled).toBe(true);
    // after a real fill the node is a `quote` that keeps the slot id
    const filled = { sections: [{ content: { type: "doc", content: [{ type: "quote", attrs: { slot_id: "hare-lion", origin: "excerpt_slot", rights: "public-domain", source_ref: '{"title":"Synthetic Reader"}' } }] } }] };
    await t.db.with_tx(async (tx) => {
      await insert_row(tx, "lesson_doc", { lesson_id: l5, seq: 3, derived_json: JSON.stringify(filled) });
    });
    expect((await repo.dependencies(l4))[0]!.slot_filled).toBe(true);
  });

  it("mark_adopted_and_source_outline_version", async () => {
    const unit = "G6.U12";
    await seed(unit, 1, 2);
    const id = `${unit}.L1`;
    const run_a = ids.new_id("run"), run_b = ids.new_id("run");
    await t.db.with_tx(async (tx) => {
      await insert_row(tx, "outline_version", { id: `${unit}.ov1`, unit_id: unit, number: 1 });
      await insert_row(tx, "outline_version", { id: `${unit}.ov2`, unit_id: unit, number: 2 });
      await insert_row(tx, "run", { id: run_a, unit_id: unit, outline_version_id: `${unit}.ov1` });
      await insert_row(tx, "run", { id: run_b, unit_id: unit, outline_version_id: `${unit}.ov2` });
    });
    expect(await repo.source_outline_version(`${unit}.L2`)).toBeNull();
    await gen(id, unit, "generated", run_a);
    expect(await repo.source_outline_version(id)).toBe(`${unit}.ov1`);
    const c = await gen(id, unit, "candidate", run_b);
    expect(await repo.source_outline_version(id)).toBe(`${unit}.ov1`);
    const adopted = await t.db.with_tx((tx) => repo.mark_adopted(c.version.version_id, tx));
    expect(adopted.adopted).toBe(true);
    expect(await repo.source_outline_version(id)).toBe(`${unit}.ov2`);
    const err = await t.db.with_tx((tx) => repo.mark_adopted(c.version.version_id, tx)).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(DomainRefusal);
    expect((err as DomainRefusal).code).toBe("INVALID_TRANSITION");
    expect((await repo.version(c.version.version_id))?.adopted).toBe(true);
  });
});
