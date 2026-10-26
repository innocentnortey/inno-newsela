// NL-81 integration: the runner against the real repos on the test Postgres (scripts/test-db.sh up).
// Fakes: the outline and standard repos only (in-memory, as in context-loader.test.ts).
import { createHash } from "node:crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { FakeClock, SystemClock } from "@ls/core/ports/clock";
import { PrefixedIdGenerator } from "@ls/core/ports/ids";
import type { CheckQueue, ClaimedCheck } from "@ls/core/ports/check-queue";
import { CheckContextLoader } from "@ls/core/checks/context-loader";
import { CHECK_RULES } from "@ls/core/checks/registry";
import { CHECK_POLICY } from "@ls/core/checks/policy";
import type { CheckRuleList } from "@ls/core/checks/types";
import row_wp1 from "../../../../packages/core/tests/fixtures/row-wp1.json" with { type: "json" };
import { NormalizedRow } from "@ls/schema/outline";
import type { StoredLesson } from "@ls/schema/lesson";
import { create_logger } from "@ls/obs/logger";
import { create_test_db, type TestDb } from "@ls/db/testing/test-db";
import { insert_row } from "@ls/db/testing/insert-row";
import { PgCheckQueue } from "@ls/db/repos/check-queue";
import { PgIssueRepo } from "@ls/db/repos/issue-repo";
import { PgAlignmentRepo, PgSafetyFlagRepo, PgSuggestionRepo } from "@ls/db/repos/review-extras";
import { PgLessonRepo } from "@ls/db/repos/lessons";
import { PgLessonDocReader } from "@ls/db/repos/lesson-doc-reads";
import { wp1 } from "@ls/db/repos/lesson-docs.test-support";
import { CHECK_LEASE_MS, CheckJobRunner } from "./check-job-runner.ts";
import { CheckLane } from "./check-lane.ts";

const MARKER = "CHECK-QZ-81";
const KEY = "sk-test-NL81-MARKER";
const T0 = new Date("2026-10-01T10:00:00.000Z");
const UNIT = "G6.U4";
const OV = `${UNIT}.ov1`;

let t: TestDb;
let clock: FakeClock;
let queue: PgCheckQueue;
let issues: PgIssueRepo;
let reader: PgLessonDocReader;
let alignment: PgAlignmentRepo;
let graph: PgLessonRepo;
let loader: CheckContextLoader;
let lines: string[];
let n = 100;
const ids = new PrefixedIdGenerator();
const known = new Map<string, NormalizedRow>();

const new_id = (): string => `G6.U4.L${++n}`;
const hash_of = (l: StoredLesson): string =>
  `sha256:${createHash("sha256").update(JSON.stringify(l)).digest("hex")}`;
const lesson_for = (id: string, mutate?: (l: StoredLesson) => void): StoredLesson => {
  const l = { ...wp1(), lesson_id: id } as StoredLesson;
  mutate?.(l);
  return l;
};
const sql = async (text: string, values: unknown[] = []): Promise<Record<string, any>[]> =>
  t.db.with_tx(async (tx) => (await tx.query(text, values)).rows as Record<string, any>[]);

async function seed_lesson(id: string): Promise<void> {
  known.set(id, NormalizedRow.parse({ ...row_wp1, row_number: known.size + 5, lesson_id: id, number: n }));
  await t.db.with_tx(async (tx) => {
    await insert_row(tx, "lesson", { id, unit_id: UNIT, state: "in_review", last_editor_id: null });
  });
}
// Stores a derived row (what the store would write) and, by default, enqueues its check in the same tx.
async function put(l: StoredLesson, enqueue = true): Promise<{ hash: string; store_id: string }> {
  const hash = hash_of(l);
  return t.db.with_tx(async (tx) => {
    const seq = Number((await tx.query("SELECT coalesce(max(seq),0)+1 AS s FROM lesson_doc WHERE lesson_id=$1", [l.lesson_id])).rows[0]!["s"]);
    const store_id = `st_${l.lesson_id}_${seq}`;
    await insert_row(tx, "lesson_doc", {
      lesson_id: l.lesson_id, seq, store_id, content_hash: hash, derived_json: l, stored_at: clock.now().toISOString(),
    });
    if (enqueue) await queue.enqueue(l.lesson_id as never, hash as never, store_id as never, tx);
    return { hash, store_id };
  });
}
const link = (from: string, to: string): Promise<void> =>
  t.db.with_tx(async (tx) => {
    await insert_row(tx, "lesson_link", { outline_version_id: OV, from_lesson_id: from, to_lesson_id: to, kind: "prior", slot_id: "s1" });
  });

const outlines = {
  async list_units() {
    return [{ unit_id: UNIT, grade: 6, title: "t", latest_outline_version_id: OV }];
  },
  async rows() {
    return [...known.values()].map((row) => ({ outline_version_id: OV, row, row_hash: "r".repeat(64) }));
  },
  async row_context(_v: string, id: string) {
    return { outline_version_id: OV, row: known.get(id)!, row_hash: "r".repeat(64), arc_header: null, neighbours: [], unit_rules: [], links: [], choices: [] };
  },
};
const standards = {
  async index() {
    return { leaves_of: (c: string) => [c], text_of: () => null, resolve: () => { throw new Error("x"); } };
  },
  async texts(codes: readonly string[]) {
    return codes.map((code) => ({ code, set: "CA_CCSS_ELA_6", text: `Synthetic text for ${code}`, parent_code: null, is_leaf: true, eld_strand: null }));
  },
};

function make_runner(over: { rules?: CheckRuleList; ldr?: Pick<CheckContextLoader, "load">; q?: CheckQueue } = {}): CheckJobRunner {
  const logger = create_logger({ service: "worker-test", build_id: "t", write: (s) => lines.push(s) });
  return new CheckJobRunner(
    over.q ?? queue, reader, issues, alignment, graph, over.ldr ?? loader,
    over.rules ?? CHECK_RULES, CHECK_POLICY, t.db, clock, logger,
  );
}
const runner = (): CheckJobRunner => make_runner();
const throwing = (fail: (lesson_id: string) => boolean): CheckRuleList =>
  CHECK_RULES.map((r, i) =>
    i === 0 ? { kind: r.kind, level: r.level, run: (c, p) => { if (fail(c.lesson_id)) throw new Error(`boom ${MARKER} ${KEY}`); return r.run(c, p); } } : r,
  );
const issue_rows = (id: string) => sql("SELECT * FROM issue WHERE lesson_id=$1", [id]);
const job_rows = (id: string) => sql("SELECT * FROM check_job WHERE lesson_id=$1 ORDER BY id", [id]);
// Alignment links come only from per-code tags on headings; the shared stored WP-1 fixture carries none.
const with_teaching_tag = (l: StoredLesson): void => {
  l.sections[0]!.content.content!.push(
    { type: "routine_heading", attrs: { icon: "notes_section" }, content: [{ type: "text", text: "Voice (RL.6.1)" }] },
    { type: "paragraph", content: [{ type: "text", text: "Teach the voice." }] },
  );
};
const drop_section = (l: StoredLesson): void => {
  l.sections = l.sections.slice(0, -1);
};
const add_paragraph = (text: string) => (l: StoredLesson): void => {
  const doc = l.sections[0]!.content as { content: unknown[] };
  doc.content.push({ type: "paragraph", attrs: { align: null }, content: [{ type: "text", text }] });
};

beforeAll(async () => {
  t = await create_test_db({ pool_max: 6 });
  clock = new FakeClock(T0);
  const rd = { db: t.db, ids, clock };
  queue = new PgCheckQueue(rd);
  issues = new PgIssueRepo(rd);
  alignment = new PgAlignmentRepo(rd);
  graph = new PgLessonRepo(rd);
  reader = new PgLessonDocReader({ db: t.db });
  loader = new CheckContextLoader(
    outlines as never, standards as never, graph, reader,
    new PgSuggestionRepo(rd), new PgSafetyFlagRepo(rd), alignment, clock,
  );
  await t.db.with_tx(async (tx) => {
    await insert_row(tx, "outline_version", { id: OV, unit_id: UNIT, number: 1 });
  });
});
afterAll(async () => {
  await t.drop();
});
beforeEach(async () => {
  lines = [];
  // claim() takes the oldest job in the database, so every test starts from an empty queue.
  await sql("DELETE FROM check_job");
});

describe("CheckJobRunner", () => {
  it("test_checks_after_store_capture", async () => {
    const id = new_id();
    await seed_lesson(id);
    const stored = await put(lesson_for(id, (l) => { drop_section(l); with_teaching_tag(l); }));
    clock.advance(1500);
    const report = await runner().run_once();
    expect(report).not.toBeNull();
    expect(report!.content_hash).toBe(stored.hash);
    const rows = await issue_rows(id);
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((r) => r["content_hash"] === stored.hash)).toBe(true);
    expect(rows.some((r) => r["level"] === "blocking" && r["kind"] === "section_missing")).toBe(true);
    const pending = await queue.pending_for(id as never);
    expect(pending.pending).toBe(false);
    const set = await issues.current(id as never);
    expect(set.checked_hash).toBe(stored.hash);
    expect(set.checked_at!.getTime() - pending.latest_stored_at!.getTime()).toBeLessThanOrEqual(5000);
    expect((await job_rows(id)).map((j) => j["status"])).toEqual(["done"]);
    const links = await sql("SELECT * FROM alignment_link WHERE lesson_id=$1", [id]);
    expect(links.length).toBeGreaterThan(0);
    expect(links.every((l) => l["content_hash"] === stored.hash)).toBe(true);
  });

  it("not_blocked_by_generation_slots", async () => {
    const id = new_id();
    await seed_lesson(id);
    await put(lesson_for(id, drop_section));
    // Six generation slots held by promises that never resolve; the check lane has no part in them.
    let slots = 0;
    for (let i = 0; i < 6; i += 1) {
      slots += 1;
      void new Promise<void>(() => undefined);
    }
    const logger = create_logger({ service: "worker-test", build_id: "t", write: (s) => lines.push(s) });
    const lane = new CheckLane(runner(), new SystemClock(), logger, { check_poll_ms: 20 });
    let stopped = false;
    const started = Date.now();
    const done = lane.run_until({ is_set: () => stopped });
    for (;;) {
      if ((await job_rows(id))[0]?.["status"] === "done") break;
      if (Date.now() - started > 2000) break;
      await new Promise((r) => setTimeout(r, 10));
    }
    stopped = true;
    await done;
    expect(Date.now() - started).toBeLessThan(2000);
    expect((await job_rows(id))[0]!["status"]).toBe("done");
    expect(slots).toBe(6);
  });

  it("coalesced_newer_hash_wins", async () => {
    const id = new_id();
    await seed_lesson(id);
    const v1 = lesson_for(id, drop_section);
    const v2 = lesson_for(id, (l) => { drop_section(l); l.title = `${l.title} (edit)`; });
    await put(v1);
    // A newer store lands right after H1 is claimed, so H1 is running and H2 is queued.
    let fired = false;
    const hooked: CheckQueue = {
      enqueue: (...a) => queue.enqueue(...a),
      finish: (c) => queue.finish(c),
      pending_for: (l) => queue.pending_for(l),
      claim: async (ms: number): Promise<ClaimedCheck | null> => {
        const c = await queue.claim(ms);
        if (c && !fired) { fired = true; await put(v2); }
        return c;
      },
    };
    const r = make_runner({ q: hooked });
    expect(await r.run_once()).toBeNull(); // H1 superseded
    expect((await issue_rows(id)).length).toBe(0);
    const second = await r.run_once();
    expect(second!.content_hash).toBe(hash_of(v2));
    const rows = await issue_rows(id);
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((x) => x["content_hash"] === hash_of(v2))).toBe(true);
    expect((await job_rows(id)).map((j) => j["status"])).toEqual(["done", "done"]);
  });

  it("rule_throw_rolls_back_and_continues", async () => {
    const a = new_id();
    const b = new_id();
    await seed_lesson(a);
    await seed_lesson(b);
    const pa = await put(lesson_for(a, drop_section));
    clock.advance(10);
    await put(lesson_for(b, drop_section));
    const r = make_runner({ rules: throwing((id) => id === a) });
    expect(await r.run_once()).toBeNull();
    expect((await issue_rows(a)).length).toBe(0);
    expect((await sql("SELECT 1 FROM alignment_link WHERE lesson_id=$1", [a])).length).toBe(0);
    expect((await job_rows(a))[0]!["status"]).toBe("running");
    const failed = lines.map((x) => JSON.parse(x)).find((x) => x.event === "check.failed");
    expect(failed.lesson_id).toBe(a);
    expect(failed.extra).toMatchObject({ content_hash: pa.hash, rule: CHECK_RULES[0]!.kind, name: "RuleFailure" });
    expect(lines.join("\n")).not.toContain(MARKER);
    expect(lines.join("\n")).not.toContain(KEY);
    // The next claim is the second lesson.
    const next = await r.run_once();
    expect(next!.lesson_id).toBe(b);
    // Lease expiry hands the first one out again.
    clock.advance(CHECK_LEASE_MS + 1);
    const again = await queue.claim(CHECK_LEASE_MS);
    expect(again!.lesson_id).toBe(a);
  });

  it("resolutions_carry_forward", async () => {
    const id = new_id();
    await seed_lesson(id);
    await put(lesson_for(id, drop_section));
    await runner().run_once();
    const first = (await issues.current(id as never)).issues.find((i) => i.kind === "section_missing")!;
    await t.db.with_tx((tx) => issues.resolve({ issue_id: first.issue_id, by: "usr_test" as never, reason: "ok", request_id: "req_1" as never }, tx));
    clock.advance(10);
    const v2 = lesson_for(id, (l) => { drop_section(l); l.title = `${l.title} (v2)`; });
    await put(v2);
    await runner().run_once();
    const now = await issues.current(id as never);
    expect(now.checked_hash).toBe(hash_of(v2));
    const carried = now.issues.find((i) => i.kind === "section_missing" && i.address === first.address);
    expect(carried?.resolved_at).not.toBeNull();
    expect(carried?.resolved_by).toBe("usr_test");
  });

  it("dependants_requeued", async () => {
    const a = new_id();
    const b = new_id();
    const c = new_id();
    for (const id of [a, b, c]) await seed_lesson(id);
    await link(b, a); // b links to a, so b is a dependant of a
    await put(lesson_for(b), false);
    await put(lesson_for(c), false);
    await put(lesson_for(a, drop_section));
    const r = runner();
    const report = await r.run_once();
    expect(report!.dependants_requeued).toBeGreaterThanOrEqual(1);
    const queued = await sql("SELECT * FROM check_job WHERE status='queued'");
    expect(queued.map((j) => j["lesson_id"])).toEqual([b]);
    // Unlinked lesson: nothing re-queued.
    await sql("DELETE FROM check_job");
    await put(lesson_for(c, (l) => { l.title = "other"; }));
    expect((await r.run_once())!.dependants_requeued).toBe(0);
    // A -> B -> A cycle ends: the second check of the same hash re-queues nothing.
    await sql("DELETE FROM check_job");
    const x = new_id();
    const y = new_id();
    await seed_lesson(x);
    await seed_lesson(y);
    await link(x, y);
    await link(y, x);
    await put(lesson_for(y), false);
    await put(lesson_for(x));
    let runs = 0;
    while ((await r.run_once()) !== null) {
      runs += 1;
      expect(runs).toBeLessThan(10);
    }
    expect(runs).toBe(3);
  });

  it("idempotent_and_modelless", async () => {
    const id = new_id();
    await seed_lesson(id);
    const l = lesson_for(id, drop_section);
    const r = runner();
    let count = -1;
    for (let i = 0; i < 20; i += 1) {
      await put(l);
      expect(await r.run_once()).not.toBeNull();
      const now = (await issue_rows(id)).length;
      if (count >= 0) expect(now).toBe(count);
      count = now;
    }
    expect(Number((await sql("SELECT count(*)::int AS c FROM model_call"))[0]!["c"])).toBe(0);
  });

  it("expired_lease_reclaimed", async () => {
    const id = new_id();
    await seed_lesson(id);
    const stored = await put(lesson_for(id, drop_section));
    const dead = await queue.claim(CHECK_LEASE_MS); // a worker that then died
    expect(dead!.lesson_id).toBe(id);
    expect(await runner().run_once()).toBeNull(); // lease still held
    clock.advance(CHECK_LEASE_MS + 1);
    const report = await runner().run_once();
    expect(report!.content_hash).toBe(stored.hash);
    expect((await job_rows(id)).map((j) => j["status"])).toEqual(["done"]);
  });

  it("grounding_findings_through_runner", async () => {
    const id = new_id();
    await seed_lesson(id);
    await put(lesson_for(id, add_paragraph(
      "Listen to how Percy opens: “Nobody at my school ever listened to me.” Reread page 27 with a partner. Percy’s friend Grover also gets into trouble.",
    )));
    await runner().run_once();
    const rows = await issue_rows(id);
    const by = (k: string) => rows.filter((r) => r["kind"] === k);
    expect(by("quote_unmatched").some((r) => r["level"] === "blocking")).toBe(true);
    expect(by("page_out_of_range").some((r) => r["level"] === "blocking")).toBe(true);
    // proper_noun_unsourced is blocking only inside a cfu_item; this plant is in plain text.
    expect(by("proper_noun_unsourced").every((r) => r["level"] === "advisory")).toBe(true);
    expect(by("proper_noun_unsourced").length).toBeGreaterThan(0);
  });

  it("no_text_or_key_in_logs", async () => {
    const a = new_id();
    const b = new_id();
    await seed_lesson(a);
    await seed_lesson(b);
    const sentence = `The class reads ${MARKER} aloud with ${KEY} on the board.`;
    await put(lesson_for(a, add_paragraph(sentence)));
    await put(lesson_for(b, add_paragraph(sentence)));
    const r = make_runner({ rules: throwing((id) => id === a) });
    await r.run_once(); // fails
    await r.run_once(); // succeeds
    const jobs = JSON.stringify(await sql("SELECT * FROM check_job"));
    for (const hay of [lines.join("\n"), jobs]) {
      expect(hay).not.toContain(MARKER);
      expect(hay).not.toContain(KEY);
    }
    expect(lines.length).toBeGreaterThan(0);
  });
});
