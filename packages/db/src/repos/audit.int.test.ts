// NL-12
import { FakeClock } from "@ls/core/ports/clock";
import { PrefixedIdGenerator } from "@ls/core/ports/ids";
import { InvariantViolation } from "@ls/core/errors";
import type { NewAuditEvent } from "@ls/core/ports/audit";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { insert_row } from "../testing/insert-row.ts";
import { create_test_db, type TestDb } from "../testing/test-db.ts";
import { PgAuditLog } from "./audit.ts";

let t: TestDb;
let clock: FakeClock;
let audit: PgAuditLog;
const ids = new PrefixedIdGenerator();
const USER = ids.new_id("usr");

const event = (over: Partial<NewAuditEvent> = {}): NewAuditEvent => ({
  actor_id: USER, action: "lesson.store", target_kind: "lesson", target_id: "G6.U4.L1",
  version_hash: null, reason: null, details: {}, request_id: null, store_id: null, ...over,
});
const count = async (where = "true", values: unknown[] = []): Promise<number> =>
  t.db.with_tx(async (tx) => Number((await tx.query(`SELECT count(*)::int AS n FROM audit_event WHERE ${where}`, values)).rows[0]?.["n"]));

beforeAll(async () => {
  t = await create_test_db();
  clock = new FakeClock(new Date("2026-10-01T10:00:00.000Z"));
  audit = new PgAuditLog({ db: t.db, ids, clock });
  await t.db.with_tx(async (tx) => {
    await insert_row(tx, "app_user", { id: USER, name: "Ada Test" });
  });
});
afterAll(async () => {
  await t.drop();
});

describe("PgAuditLog", () => {
  it("append_and_rollback: commits with the caller's tx and vanishes on rollback", async () => {
    const id = await t.db.with_tx((tx) => audit.append(event({ target_id: "G6.U4.L3" }), tx));
    expect(id).toMatch(/^ae_[0-9A-HJKMNP-TV-Z]{26}$/);
    const row = await t.db.with_tx(async (tx) => (await tx.query("SELECT at FROM audit_event WHERE id=$1", [id])).rows[0]);
    expect((row?.["at"] as Date).toISOString()).toBe(clock.now().toISOString());

    await expect(
      t.db.with_tx(async (tx) => {
        await audit.append(event({ target_id: "G6.U4.L4" }), tx);
        throw new Error("abort");
      }),
    ).rejects.toThrow("abort");
    expect(await count("target_id=$1", ["G6.U4.L4"])).toBe(0);
    expect(await count("target_id=$1", ["G6.U4.L3"])).toBe(1);
  });

  it("append refuses a transaction handle that is not a real one", async () => {
    await expect(audit.append(event(), {})).rejects.toBeInstanceOf(InvariantViolation);
  });

  it("details_guard: rejects emails and long text before any SQL, accepts 120 chars", async () => {
    await expect(t.db.with_tx((tx) => audit.append(event({ target_id: "G6.U4.L5", details: { who: "a@b.example" } }), tx))).rejects.toBeInstanceOf(InvariantViolation);
    expect(await count("target_id=$1", ["G6.U4.L5"])).toBe(0);

    const err = await t.db
      .with_tx((tx) => audit.append(event({ target_id: "G6.U4.L5", details: { note: "lesson-text-MARKER-3b8" + "x".repeat(300) } }), tx))
      .catch((e: unknown) => e);
    expect(err).toBeInstanceOf(InvariantViolation);
    expect(JSON.stringify((err as InvariantViolation).details)).not.toContain("MARKER");
    expect(await count("details_json::text LIKE '%lesson-text-MARKER-3b8%'")).toBe(0);

    await t.db.with_tx((tx) => audit.append(event({ target_id: "G6.U4.L5", details: { note: "y".repeat(120) } }), tx));
    expect(await count("target_id=$1", ["G6.U4.L5"])).toBe(1);
  });

  it("details_guard: before_entry.official_text may be 500 chars, no more; other strings stay at 120", async () => {
    const ok = { before_entry: { official_text: "o".repeat(500) } };
    await t.db.with_tx((tx) => audit.append(event({ target_id: "G6.U4.L6", details: ok }), tx));
    for (const details of [{ before_entry: { official_text: "o".repeat(501) } }, { before_entry: { other: "o".repeat(121) } }] as never[]) {
      await expect(t.db.with_tx((tx) => audit.append(event({ target_id: "G6.U4.L6", details }), tx))).rejects.toBeInstanceOf(InvariantViolation);
    }
    expect(await count("target_id=$1", ["G6.U4.L6"])).toBe(1);
  });

  it("details_guard: rejects long or email object keys and non-JSON values", async () => {
    for (const details of [{ ["k".repeat(121)]: 1 }, { "a@b.example": 1 }, { n: Number.NaN }, { f: undefined }, { l: [{ s: "z".repeat(121) }] }]) {
      await expect(t.db.with_tx((tx) => audit.append(event({ target_id: "G6.U4.L5", details: details as never }), tx))).rejects.toBeInstanceOf(InvariantViolation);
    }
  });

  it("history: unions review and audit rows in time order; unknown lesson is empty", async () => {
    await t.db.with_tx(async (tx) => {
      await insert_row(tx, "review_event", {
        lesson_id: "G6.U4.L1", actor_id: USER, from_state: "in_review", to_state: "approved",
        content_hash: "h1", reason: "ok", at: "2026-10-01T09:00:00Z",
      });
    });
    clock.advance(60_000);
    await t.db.with_tx((tx) => audit.append(event({ target_id: "G6.U4.L1", action: "lesson.store" }), tx));
    const rows = await audit.history("G6.U4.L1");
    expect(rows.map((r) => r.source)).toEqual(["review_event", "audit_event"]);
    expect(rows[0]).toMatchObject({ actor_name: "Ada Test", from_state: "in_review", to_state: "approved" });
    expect(rows[0]?.at).toBeInstanceOf(Date);
    expect(await audit.history("G6.U4.L9")).toEqual([]);
  });

  it("standard_decisions_newest_first: only this lesson and code, newest first, details parsed", async () => {
    const entry = { code: "RL.6.1", role: "focus", origin: "outline", official_text: "Cite textual evidence.", asserted_by: "outline", confirmation: "open" } as const;
    const link = { lesson_id: "G6.U4.L1", content_hash: "a".repeat(64), code: "RL.6.1", address: "s1", role: "I", origin: "outline", asserted_by: "outline", confirmed_by: null } as const;
    const decide = (action: string, target_id: string, code: string) =>
      t.db.with_tx(async (tx) => {
        clock.advance(1000);
        return audit.append(event({ action, target_id, details: { code, decision: action.slice(9), before_entry: entry, before_links: [link] } }), tx);
      });
    const a = await decide("standard.confirm", "G6.U4.L1", "RL.6.1");
    const b = await decide("standard.remove", "G6.U4.L1", "RL.6.1");
    const c = await decide("standard.undo", "G6.U4.L1", "RL.6.1");
    await decide("standard.confirm", "G6.U4.L1", "RL.6.2");
    await decide("standard.confirm", "G6.U4.L2", "RL.6.1");
    await t.db.with_tx((tx) => audit.append(event({ action: "lesson.store", details: { code: "RL.6.1" } }), tx));

    const rows = await audit.standard_decisions("G6.U4.L1", "RL.6.1");
    expect(rows.map((r) => [r.audit_id, r.decision])).toEqual([[c, "undo"], [b, "remove"], [a, "confirm"]]);
    expect(rows[0]).toMatchObject({ by: USER, lesson_id: "G6.U4.L1", code: "RL.6.1", before_entry: entry, before_links: [link] });
  });
});
