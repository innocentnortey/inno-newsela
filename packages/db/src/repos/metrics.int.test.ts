// NL-48
import Decimal from "decimal.js";
import { compute_lesson_metrics } from "@ls/core/metrics/frozen-row";
import { FakeClock } from "@ls/core/ports/clock";
import type { HeartbeatRecord } from "@ls/core/ports/metrics";
import { PrefixedIdGenerator } from "@ls/core/ports/ids";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { insert_row } from "../testing/insert-row.ts";
import { create_test_db, type TestDb } from "../testing/test-db.ts";
import { PgBoardReadRepo, PgMetricsRepo } from "./metrics.ts";

let t: TestDb;
let repo: PgMetricsRepo;
let board: PgBoardReadRepo;
const ids = new PrefixedIdGenerator();
const REVIEWER = ids.new_id("usr");
const SYNTH = ids.new_id("usr");
const T0 = Date.parse("2026-10-01T10:00:00.000Z");
const GAP = 60;

const w = <T>(fn: (tx: any) => Promise<T>): Promise<T> => t.db.with_tx(fn);
const hb = (user: string, lesson: string, version: string, tab: string, s: number, over: Partial<HeartbeatRecord> = {}): HeartbeatRecord =>
  ({ user_id: user, tab_id: tab, lesson_id: lesson, version_id: version, at: new Date(T0 + s * 1000), active: true, synthetic: false, ...over }) as HeartbeatRecord;
const count = async (table: string, where = "true"): Promise<number> =>
  w(async (tx) => Number((await tx.query(`SELECT count(*)::int AS n FROM ${table} WHERE ${where}`)).rows[0].n));

beforeAll(async () => {
  t = await create_test_db();
  const deps = { db: t.db, ids, clock: new FakeClock(new Date(T0)) };
  repo = new PgMetricsRepo(deps);
  board = new PgBoardReadRepo(deps);
  await w(async (tx) => {
    await insert_row(tx, "app_user", { id: REVIEWER, name: "Test Reviewer", synthetic: false });
    await insert_row(tx, "app_user", { id: SYNTH, name: "Synthetic Reviewer", synthetic: true });
  });
});
afterAll(async () => {
  await t.drop();
});

describe("PgMetricsRepo", () => {
  it("sessions_match_script", async () => {
    const lessons = { "G6.U4.L1": ids.new_id("lv"), "G6.U4.L3": ids.new_id("lv"), "G6.U4.L4": ids.new_id("lv") };
    type Seg = { lesson: keyof typeof lessons; tab: string; from: number; to: number; active: boolean };
    const script: Seg[] = [
      { lesson: "G6.U4.L1", tab: "A", from: 0, to: 240, active: true },
      { lesson: "G6.U4.L1", tab: "A", from: 255, to: 540, active: false },
      { lesson: "G6.U4.L1", tab: "B", from: 260, to: 540, active: false },
      { lesson: "G6.U4.L1", tab: "A", from: 540, to: 900, active: true },
      { lesson: "G6.U4.L1", tab: "B", from: 605, to: 900, active: true },
      { lesson: "G6.U4.L3", tab: "A", from: 1000, to: 1360, active: true },
      { lesson: "G6.U4.L4", tab: "A", from: 1500, to: 1980, active: true },
      { lesson: "G6.U4.L4", tab: "B", from: 1800, to: 1980, active: true },
    ];
    const events: Array<{ t: number; seg: Seg }> = [];
    for (const seg of script) for (let s = seg.from; s <= seg.to; s += 15) events.push({ t: s, seg });
    events.sort((a, b) => a.t - b.t);
    let before = -1;
    let after = -1;
    for (const e of events) {
      const rec = hb(REVIEWER, e.seg.lesson, lessons[e.seg.lesson], e.seg.tab, e.t, { active: e.seg.active });
      await repo.insert_heartbeat(rec);
      await repo.extend_session(rec, GAP);
      const l1 = e.seg.lesson === "G6.U4.L1" ? (await repo.sessions_for("G6.U4.L1" as any))[0] : undefined;
      if (e.t === 240 && l1) before = l1.active_seconds;
      if (e.t === 540 && l1) after = l1.active_seconds;
    }
    const mins = async (l: string) => (await repo.sessions_for(l as any)).reduce((n, s) => n + s.active_seconds, 0) / 60;
    expect(Math.abs((await mins("G6.U4.L1")) - 10)).toBeLessThanOrEqual(1);
    expect(Math.abs((await mins("G6.U4.L3")) - 6)).toBeLessThanOrEqual(1);
    expect(Math.abs((await mins("G6.U4.L4")) - 8)).toBeLessThanOrEqual(1);
    expect(after - before).toBeLessThanOrEqual(60);
    expect(await count("review_session", `user_id='${REVIEWER}'`)).toBe(3);
  });

  it("spacing_and_synthetic", async () => {
    const v = ids.new_id("lv");
    const l = "G6.U4.L5";
    const a = hb(REVIEWER, l, v, "A", 0);
    const b = hb(REVIEWER, l, v, "A", 5);
    await repo.insert_heartbeat(a);
    await repo.insert_heartbeat(b); // stored, but the service skips extend_session for it
    await repo.extend_session(a, GAP);
    expect(await count("heartbeat", `lesson_id='${l}'`)).toBe(2);
    const sessions = await repo.sessions_for(l as any);
    expect(sessions).toHaveLength(1);
    expect(sessions[0]?.active_seconds).toBe(0);
    const sv = ids.new_id("lv");
    const s = hb(SYNTH, l, sv, "S", 0, { synthetic: true });
    await repo.insert_heartbeat(s);
    await repo.extend_session(s, GAP);
    await repo.extend_session({ ...s, at: new Date(T0 + 30_000) }, GAP);
    expect(await count("heartbeat", `lesson_id='${l}' AND synthetic`)).toBe(1);
    const all = await repo.sessions_for(l as any);
    const m = compute_lesson_metrics(all, { version_id: v, lesson_id: l, teacher_word_count: 500 } as any, "rewritten", new Date(T0));
    expect(all.some((x) => x.synthetic && x.active_seconds === 30)).toBe(true);
    expect(m.active_minutes.toString()).toBe("0");
    expect(m.human_sessions).toBe(1);
  });

  it("concurrent_tabs_one_row", async () => {
    const v = ids.new_id("lv");
    const l = "G6.U4.L6";
    await Promise.all([repo.extend_session(hb(REVIEWER, l, v, "A", 0), GAP), repo.extend_session(hb(REVIEWER, l, v, "B", 0), GAP)]);
    expect(await count("review_session", `lesson_id='${l}'`)).toBe(1);
  });

  it("write_lesson_metrics_once", async () => {
    const l = "G6.U4.L7" as any;
    const row = {
      lesson_id: l, version_id: ids.new_id("lv") as any, active_minutes: new Decimal("10.5"), human_sessions: 2,
      teacher_word_count: 1250, g2_threshold_minutes: new Decimal("2.5"), draft_rating: "usable_with_edits" as const,
      approved_at: new Date(T0),
    };
    await w((tx) => insert_row(tx, "lesson", { id: l, unit_id: "G6.U4", number: 7 }));
    expect(await w((tx) => repo.first_approval_exists(l, tx))).toBe(false);
    expect(await t.db.with_tx((tx) => repo.write_lesson_metrics(row, tx))).toBe(true);
    const stored = await w(async (tx) => (await tx.query("SELECT * FROM lesson_metrics WHERE lesson_id=$1", [l])).rows[0]);
    expect(await t.db.with_tx((tx) => repo.write_lesson_metrics({ ...row, active_minutes: new Decimal("99"), draft_rating: "rewritten" }, tx))).toBe(false);
    const again = await w(async (tx) => (await tx.query("SELECT * FROM lesson_metrics WHERE lesson_id=$1", [l])).rows[0]);
    expect(again).toEqual(stored);
    expect(await w((tx) => repo.first_approval_exists(l, tx))).toBe(true);
    const rows = await repo.unit_metrics_rows("G6.U4" as any);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.active_minutes.toString()).toBe("10.5");
    expect(rows[0]?.draft_rating).toBe("usable_with_edits");
  });
});

describe("PgBoardReadRepo", () => {
  it("board_rows_shape_and_filter", async () => {
    const U = "G6.U9";
    const [a, b, c] = ["G6.U9.L1", "G6.U9.L2", "G6.U9.L3"];
    const OV = ids.new_id("ov");
    await w(async (tx) => {
      await insert_row(tx, "lesson", { id: a, unit_id: U, number: 1, state: "in_review", reviewer_id: REVIEWER });
      await insert_row(tx, "lesson", { id: b, unit_id: U, number: 2, state: "draft" });
      await insert_row(tx, "lesson", { id: c, unit_id: U, number: 3, state: "approved" });
      await insert_row(tx, "outline_version", { id: OV, unit_id: U, number: 1 });
      await insert_row(tx, "lesson_link", { outline_version_id: OV, from_lesson_id: a, to_lesson_id: b, kind: "prior", slot_id: "s1" });
      await insert_row(tx, "review_event", { id: ids.new_id("ev"), lesson_id: a, at: new Date(T0 + 5000).toISOString() });
    });
    const all = await board.board_rows(U as any, null);
    expect(all.map((r) => r.lesson_id)).toEqual([a, b, c]);
    expect(all[0]?.reviewer_name).toBe("Test Reviewer");
    expect(all[0]?.last_change_at.getTime()).toBe(T0 + 5000);
    expect(all.map((r) => r.dependency_flag)).toEqual([true, false, false]);
    const only = await board.board_rows(U as any, "in_review");
    expect(only.map((r) => r.lesson_id)).toEqual([a]);
    for (const r of all) {
      expect(Object.keys(r).sort()).toEqual(["dependency_flag", "last_change_at", "lesson_id", "number", "reviewer_name", "state", "title", "type"]);
      expect(Object.keys(r).some((k) => /minutes|seconds|user_id/.test(k))).toBe(false);
    }
  });
});
