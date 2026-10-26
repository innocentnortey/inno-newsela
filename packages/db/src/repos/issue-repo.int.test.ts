// NL-37
import { FakeClock } from "@ls/core/ports/clock";
import { DomainRefusal } from "@ls/core/errors";
import { PrefixedIdGenerator } from "@ls/core/ports/ids";
import type { CheckFinding } from "@ls/core/ports/issues";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { insert_row } from "../testing/insert-row.ts";
import { create_test_db, type TestDb } from "../testing/test-db.ts";
import { PgIssueRepo } from "./issue-repo.ts";

const H = (c: string): string => `sha256:${c.repeat(64)}`;
const H1 = H("a"), H2 = H("b"), H3 = H("c");
let t: TestDb;
let clock: FakeClock;
let repo: PgIssueRepo;
const ids = new PrefixedIdGenerator();
const USER = ids.new_id("usr");
let n = 0;
const next_lesson = (): string => `G6.U4.L${++n}`;
const F = (over: Partial<CheckFinding> = {}): CheckFinding => ({
  kind: "quote_placeholder_open", level: "blocking", message: "Quote placeholder is still open.",
  address: "lesson.blocks[3].PartA", span_anchor: null, related_lesson_id: null, code: null, ...over,
});
const replace = (l: string, h: string, f: CheckFinding[]) => {
  clock.advance(1000);
  return t.db.with_tx((tx) => repo.replace_for_hash(l, h, f, tx));
};
const resolve = (issue_id: string, reason = "ok") => {
  clock.advance(1000);
  return t.db.with_tx((tx) => repo.resolve({ issue_id, by: USER, reason, request_id: ids.new_id("req") }, tx));
};

beforeAll(async () => {
  t = await create_test_db({ pool_max: 6 });
  clock = new FakeClock(new Date("2026-10-01T10:00:00.000Z"));
  repo = new PgIssueRepo({ db: t.db, ids, clock });
  await t.db.with_tx(async (tx) => {
    await insert_row(tx, "app_user", { id: USER, name: "Ada Test" });
  });
});
afterAll(async () => {
  await t.drop();
});

describe("PgIssueRepo", () => {
  it("issues_keyed_to_hash: current returns the newest checked hash only", async () => {
    const l = next_lesson();
    expect(await repo.current(l)).toEqual({ lesson_id: l, checked_hash: null, checked_at: null, issues: [] });
    await replace(l, H1, [F(), F({ kind: "arc_repeat", level: "advisory", address: null })]);
    await replace(l, H2, [F()]);
    const cur = await repo.current(l);
    expect(cur.checked_hash).toBe(H2);
    expect(cur.issues).toHaveLength(1);
    expect(cur.issues[0]!.content_hash).toBe(H2);
  });

  it("resolution_carries_by_key: exact key carries, other address or code does not", async () => {
    const l = next_lesson();
    const a = await replace(l, H1, [F(), F({ code: "RL.6.1" })]);
    const first = a.issues.find((i) => i.code === null)!;
    await resolve(first.issue_id, "accepted");
    const b = await replace(l, H2, [F(), F({ address: "lesson.blocks[4].PartA" }), F({ code: "RL.6.2" })]);
    const carried = b.issues.filter((i) => i.resolved_at !== null);
    expect(carried).toHaveLength(1);
    expect(carried[0]).toMatchObject({ address: "lesson.blocks[3].PartA", code: null, resolved_by: USER, resolution_reason: "accepted", cleared_by: "resolution" });
    expect(b.issues.filter((i) => i.resolved_at === null)).toHaveLength(2);
    // null equals null: a finding with null address also carries
    const m = next_lesson();
    const m1 = await replace(m, H1, [F({ address: null })]);
    await resolve(m1.issues[0]!.issue_id);
    expect((await replace(m, H2, [F({ address: null })])).issues[0]!.resolved_at).not.toBeNull();
  });

  it("resolution_carries_by_key: a same-hash retry inserts nothing new", async () => {
    const l = next_lesson();
    const a = await replace(l, H1, [F()]);
    const b = await replace(l, H1, [F()]);
    expect(b.issues.map((i) => i.issue_id)).toEqual(a.issues.map((i) => i.issue_id));
    const cnt = await t.db.with_tx(async (tx) => (await tx.query("SELECT count(*)::int AS c FROM issue WHERE lesson_id=$1", [l])).rows[0]!["c"]);
    expect(cnt).toBe(1);
  });

  it("same_hash_recheck_drops_absent_finding: S-33", async () => {
    const l = next_lesson();
    const A = F({ kind: "safety_flag_open", address: null });
    const B = F({ kind: "arc_repeat", level: "advisory", address: null });
    await replace(l, H1, [A, B]);
    const r = await replace(l, H1, [B]);
    expect(r.issues.map((i) => i.kind)).toEqual(["arc_repeat"]);
    expect((await repo.current(l)).issues.map((i) => i.kind)).toEqual(["arc_repeat"]);
    const rows = await t.db.with_tx(async (tx) => (await tx.query<{ kind: string; cleared_by: string | null }>("SELECT kind, cleared_by FROM issue WHERE lesson_id=$1", [l])).rows);
    expect(rows.find((x) => x.kind === "safety_flag_open")!.cleared_by).toBe("fix");
    // it comes back if the rule fires again at the same hash
    const back = await replace(l, H1, [A, B]);
    expect(back.issues.map((i) => i.kind).sort()).toEqual(["arc_repeat", "safety_flag_open"]);
  });

  it("same_hash_recheck_keeps_judge_no: an externally written kind is not cleared by the rule engine", async () => {
    const l = next_lesson();
    const A = F({ kind: "safety_flag_open", address: null });
    await replace(l, H1, [A]);
    await t.db.with_tx(async (tx) => {
      await insert_row(tx, "issue", {
        id: ids.new_id("iss"), lesson_id: l, content_hash: H1, level: "advisory", kind: "judge_no",
        message: "Provisional.", address: "lesson.blocks[1]", code: "RL.6.1", created_at: clock.now().toISOString(),
      });
    });
    const r = await replace(l, H1, [A]);
    expect(r.issues.map((i) => i.kind).sort()).toEqual(["judge_no", "safety_flag_open"]);
    const rows = await t.db.with_tx(async (tx) => (await tx.query<{ cleared_by: string | null }>("SELECT cleared_by FROM issue WHERE lesson_id=$1 AND kind='judge_no'", [l])).rows);
    expect(rows.map((x) => x.cleared_by)).toEqual([null]);
  });

  it("same_hash_recheck_adds_new_finding", async () => {
    const l = next_lesson();
    const B = F({ kind: "arc_repeat", level: "advisory", address: null });
    const C = F({ kind: "safety_flag_open", address: null });
    await replace(l, H1, [B]);
    const r = await replace(l, H1, [B, C]);
    expect(r.issues.map((i) => i.kind).sort()).toEqual(["arc_repeat", "safety_flag_open"]);
    const cnt = await t.db.with_tx(async (tx) => (await tx.query("SELECT count(*)::int AS c FROM issue WHERE lesson_id=$1", [l])).rows[0]!["c"]);
    expect(cnt).toBe(2);
  });

  it("same_hash_recheck_keeps_resolved_row", async () => {
    const l = next_lesson();
    const A = F();
    const a = await replace(l, H1, [A]);
    await resolve(a.issues[0]!.issue_id, "accepted");
    const r = await replace(l, H1, []);
    expect(r.issues).toHaveLength(1);
    expect(r.issues[0]).toMatchObject({ cleared_by: "resolution", resolution_reason: "accepted" });
  });

  it("resolution_carries_by_key: a resolution survives a later hash that drops the finding", async () => {
    const l = next_lesson();
    const a = await replace(l, H1, [F()]);
    await resolve(a.issues[0]!.issue_id);
    await replace(l, H2, []);
    const c = await replace(l, H3, [F()]);
    expect(c.issues[0]!.resolved_at).not.toBeNull();
  });

  it("fix_clearing_and_counts: absent findings are cleared by fix; counts follow the checked hash", async () => {
    const l = next_lesson();
    await replace(l, H1, [F(), F({ kind: "arc_repeat", level: "advisory", address: null }), F({ kind: "rights_to_clear", level: "confirmation", address: "x" })]);
    const mid = await t.db.with_tx(async (tx) => (await tx.query("SELECT kind, cleared_by FROM issue WHERE lesson_id=$1", [l])).rows);
    expect(mid.every((r) => r["cleared_by"] === null)).toBe(true);
    const unit = "G6.U9";
    await t.db.with_tx(async (tx) => {
      await insert_row(tx, "lesson", { id: l, unit_id: unit, number: 2 });
      await insert_row(tx, "lesson", { id: `${l}.never`, unit_id: unit, number: 1 });
    });
    expect(await repo.counts_by_lesson(unit)).toEqual([
      { lesson_id: `${l}.never`, blocking: 0, confirmation: 0, advisory: 0 },
      { lesson_id: l, blocking: 1, confirmation: 1, advisory: 1 },
    ]);
    await replace(l, H2, [F()]);
    const after = await t.db.with_tx(async (tx) => (await tx.query("SELECT kind, cleared_by FROM issue WHERE lesson_id=$1 AND content_hash=$2", [l, H1])).rows);
    expect(after.find((r) => r["kind"] === "arc_repeat")!["cleared_by"]).toBe("fix");
    expect(after.find((r) => r["kind"] === "quote_placeholder_open")!["cleared_by"]).toBeNull(); // key still present
    expect((await repo.counts_by_lesson(unit)).find((c) => c.lesson_id === l)).toEqual({ lesson_id: l, blocking: 1, confirmation: 0, advisory: 0 });
  });

  it("resolutions_for_latest_per_key: one row per key, newest resolution", async () => {
    const l = next_lesson();
    const a = await replace(l, H1, [F(), F({ kind: "arc_repeat", level: "advisory", address: null })]);
    await resolve(a.issues[0]!.issue_id, "first");
    const b = await replace(l, H2, [F({ kind: "arc_repeat", level: "advisory", address: null }), F()]);
    const open_quote = b.issues.find((i) => i.kind === "quote_placeholder_open")!;
    expect(open_quote.resolved_at).not.toBeNull(); // carried; same resolution time as the first
    const c = await replace(l, H3, [F()]);
    // resolve arc_repeat nowhere; resolve the quote again on H3? already carried. Resolve arc via a fresh finding.
    const d = await replace(l, H1.replace("a", "d"), [F({ kind: "arc_repeat", level: "advisory", address: null })]);
    await resolve(d.issues[0]!.issue_id, "second");
    void c;
    const rs = await repo.resolutions_for(l);
    expect(rs).toHaveLength(2);
    expect(rs.find((r) => r.kind === "arc_repeat")!.resolution_reason).toBe("second");
    expect(rs.find((r) => r.kind === "quote_placeholder_open")!.resolution_reason).toBe("first");
    expect(await repo.resolutions_for(next_lesson())).toEqual([]);
  });

  it("resolve_idempotent_and_immutable: second resolve changes nothing; unknown id refuses", async () => {
    const l = next_lesson();
    const a = await replace(l, H1, [F()]);
    const id = a.issues[0]!.issue_id;
    const r1 = await resolve(id, "first");
    const r2 = await resolve(id, "second");
    expect(r2.resolution_reason).toBe("first");
    expect(r2.resolved_at).toEqual(r1.resolved_at);
    expect(await repo.get(id)).toEqual(r1);
    expect(await repo.get("iss_unknown")).toBeNull();
    await expect(resolve("iss_unknown")).rejects.toBeInstanceOf(DomainRefusal);
  });

  it("resolve_idempotent_and_immutable: message, kind and hash never change; no delete method", async () => {
    const l = next_lesson();
    const before = (await replace(l, H1, [F()])).issues[0]!;
    await resolve(before.issue_id);
    await replace(l, H1, [F()]);
    await replace(l, H2, []);
    const after = (await repo.get(before.issue_id))!;
    expect([after.message, after.kind, after.content_hash]).toEqual([before.message, before.kind, before.content_hash]);
    const methods = Object.getOwnPropertyNames(PgIssueRepo.prototype);
    expect(methods.filter((m) => /delete|remove/i.test(m))).toEqual([]);
  });
});
