// Astra slice B: report_facts and the slot-node placeholders_left against real Postgres. Synthetic rows only.
import Decimal from "decimal.js";
import { FakeClock } from "@ls/core/ports/clock";
import { PrefixedIdGenerator } from "@ls/core/ports/ids";
import type { NewRun } from "@ls/core/ports/runs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { insert_row } from "../testing/insert-row.ts";
import { create_test_db, type TestDb } from "../testing/test-db.ts";
import { PgRunRepo } from "./runs.ts";

let t: TestDb;
let repo: PgRunRepo;
const ids = new PrefixedIdGenerator();
const USER = ids.new_id("usr");
let seq = 0;

const new_run = (): NewRun => ({
  unit_id: "unit_1", outline_version_id: "G6.U4.ov1", kind: "run", prompt_version_id: "pv_1", cap_usd: new Decimal("13.00"),
  scope_rows: null, started_by: USER, parent_run_id: null, eval_run_id: null, choices: [], choices_hash: "h".repeat(64),
  lesson_links: [], idempotency_key: null,
} as unknown as NewRun);
const slot = (type: string) => ({ type, attrs: {} });
const sections_with_slots = [{ name: "A", content: [slot("quote_placeholder"), slot("quote_placeholder"), { type: "bullet_list", content: [{ type: "list_item", content: [slot("excerpt_slot")] }] }] }];

/** One run with one lesson job and one generated version. */
async function seed(sections: unknown, lesson_id = `G6.U4.L${++seq}`) {
  const run = await t.db.with_tx((tx) => repo.insert_run(new_run(), tx));
  await t.db.with_tx(async (tx) => {
    await insert_row(tx, "lesson_job", { id: `job_${seq}`, run_id: run.run_id, kind: "lesson", lesson_id, status: "ready", tile_state: "ready" });
    await insert_row(tx, "lesson_version", {
      id: `ver_${seq}_1`, lesson_id, number: 1, kind: "generated", content_hash: `hash_${seq}_1`, run_id: run.run_id,
      lesson_json: { schema_version: 1, sections },
    });
  });
  return { run_id: run.run_id, lesson_id, seq };
}

beforeAll(async () => {
  t = await create_test_db();
  repo = new PgRunRepo({ db: t.db, ids, clock: new FakeClock(new Date("2026-10-26T12:00:00.000Z")) });
});
afterAll(async () => {
  await t.drop();
});

describe("PgRunRepo report facts", () => {
  it("slot_nodes_counted_with_no_issue_rows", async () => {
    const s = await seed(sections_with_slots);
    expect((await repo.summary_rows(s.run_id)).placeholders_left).toBe(3);
    const f = await repo.report_facts(s.run_id);
    expect(f.lessons[0]?.slot_nodes).toEqual({ quote_placeholder: 2, excerpt_slot: 1 });
  });

  it("pinned_to_the_runs_version: a later edit and its issues change nothing", async () => {
    const s = await seed(sections_with_slots);
    await t.db.with_tx(async (tx) => {
      await insert_row(tx, "lesson_version", { id: `ver_${s.seq}_2`, lesson_id: s.lesson_id, number: 2, kind: "edit", content_hash: "edited", lesson_json: { sections: [] } });
      await insert_row(tx, "issue", { id: `iss_${s.seq}_new`, lesson_id: s.lesson_id, content_hash: "edited", level: "blocking", kind: "quote_unmatched" });
      await insert_row(tx, "issue", { id: `iss_${s.seq}_old`, lesson_id: s.lesson_id, content_hash: `hash_${s.seq}_1`, level: "advisory", kind: "page_out_of_range" });
    });
    const l = (await repo.report_facts(s.run_id)).lessons[0]!;
    expect(l.version?.content_hash).toBe(`hash_${s.seq}_1`);
    expect(l.slot_nodes).toEqual({ quote_placeholder: 2, excerpt_slot: 1 });
    expect(l.open_issues).toEqual([{ kind: "page_out_of_range", level: "advisory", count: 1 }]);
    expect((await repo.summary_rows(s.run_id)).placeholders_left).toBe(3);
  });

  it("other_runs_version_is_ignored", async () => {
    const s = await seed([]);
    await t.db.with_tx((tx) => insert_row(tx, "lesson_version", {
      id: `ver_${s.seq}_other`, lesson_id: s.lesson_id, number: 0, kind: "generated", content_hash: "other_run", run_id: "run_other", lesson_json: { sections: sections_with_slots },
    }));
    const l = (await repo.report_facts(s.run_id)).lessons[0]!;
    expect(l.version?.content_hash).toBe(`hash_${s.seq}_1`);
    expect(l.slot_nodes).toEqual({ quote_placeholder: 0, excerpt_slot: 0 });
  });

  it("pending_until_checked", async () => {
    const s = await seed([]);
    const before = await repo.report_facts(s.run_id);
    expect(before.checks_pending).toBe(1);
    expect(before.checked_through).toBeNull();
    expect(before.lessons[0]?.check.state).toBe("pending");
    const at = new Date("2026-10-26T13:00:00.000Z");
    await t.db.with_tx((tx) => insert_row(tx, "check_job", { lesson_id: s.lesson_id, content_hash: `hash_${s.seq}_1`, status: "done", finished_at: at }));
    const after = await repo.report_facts(s.run_id);
    expect(after.checks_pending).toBe(0);
    expect(after.lessons[0]?.check.state).toBe("checked");
    expect(after.checked_through?.toISOString()).toBe(at.toISOString());
  });

  it("open_issues_exclude_resolved_and_cleared", async () => {
    const s = await seed([]);
    const hash = `hash_${s.seq}_1`;
    await t.db.with_tx(async (tx) => {
      await insert_row(tx, "issue", { id: `i${s.seq}a`, lesson_id: s.lesson_id, content_hash: hash, level: "blocking", kind: "quote_unmatched" });
      await insert_row(tx, "issue", { id: `i${s.seq}b`, lesson_id: s.lesson_id, content_hash: hash, level: "blocking", kind: "quote_unmatched", resolved_at: new Date() });
      await insert_row(tx, "issue", { id: `i${s.seq}c`, lesson_id: s.lesson_id, content_hash: hash, level: "blocking", kind: "quote_unmatched", cleared_by: "usr_x" });
    });
    const l = (await repo.report_facts(s.run_id)).lessons[0]!;
    expect(l.open_issues).toEqual([{ kind: "quote_unmatched", level: "blocking", count: 1 }]);
    expect(l.check.state).toBe("checked");
  });

  it("seed_doc_hash_is_lowest_seq", async () => {
    const s = await seed([]);
    await t.db.with_tx(async (tx) => {
      await insert_row(tx, "lesson_doc", { lesson_id: s.lesson_id, seq: 2, content_hash: "later" });
      await insert_row(tx, "lesson_doc", { lesson_id: s.lesson_id, seq: 1, content_hash: "first" });
    });
    expect((await repo.report_facts(s.run_id)).lessons[0]?.seed_doc_hash).toBe("first");
  });
});
