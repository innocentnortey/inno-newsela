// @vitest-environment node
// NL-53 DB-backed route tests (real Postgres, real repos, real doc store, real handlers). Synthetic data only.
// Only the check-rule list (empty) and the context loader (unused with no rules) are stand-ins.
import Decimal from "decimal.js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { CheckContextLoader } from "@ls/core/checks/context-loader";
import { DomainRefusal as CoreRefusal } from "@ls/core/errors";
import { FakeClock } from "@ls/core/ports/clock";
import type { CollabCommands, ModeCommand } from "@ls/core/ports/collab-commands";
import type { LessonId, RequestId, RequestUser, StateVector, UserId } from "@ls/core/ports/common";
import type { NewReviewEvent, ReviewEventRow } from "@ls/core/ports/lesson-state";
import type { ProvenanceRecord } from "@ls/core/ports/lesson-versions";
import { PrefixedIdGenerator } from "@ls/core/ports/ids";
import type { Tx } from "@ls/core/ports/tx";
import { PgAuditLog } from "@ls/db/repos/audit";
import { PgCheckQueue } from "@ls/db/repos/check-queue";
import { PgIssueRepo } from "@ls/db/repos/issue-repo";
import { PgLessonDocStore } from "@ls/db/repos/lesson-docs";
import { PgLessonRepo } from "@ls/db/repos/lessons";
import { PgMetricsRepo } from "@ls/db/repos/metrics";
import { PgSuggestionRepo } from "@ls/db/repos/review-extras";
import { create_test_db, type TestDb } from "@ls/db/testing/test-db";
import type { LessonDraft } from "@ls/schema/lesson-draft";
import type { StoredLesson } from "@ls/schema/lesson";
import type { NormalizedRow } from "@ls/schema/outline";
import { content_hash, state_vector_of } from "@ls/ydoc/hash";
import { lesson_to_ydoc } from "@ls/ydoc/convert";
import { APP_ORIGIN, make_deps } from "@/server/http/testing/route-fixtures.ts";
import { make_with_route, type HttpRequest, type HttpResponse, type SessionResolver } from "@/server/http/with-route.ts";
import { make_transition_handlers } from "@/server/routes/transition-routes.ts";
import { ApproveService } from "@/server/services/approve-service.ts";
import { MetricsWriter } from "@/server/services/metrics-writer.ts";
import { TransitionService } from "@/server/services/transition-service.ts";

const UNIT = "G6.U4";
const ids = new PrefixedIdGenerator();
const HASH = "a".repeat(64);
const VEC = Buffer.from([1]).toString("base64");
const uid = (c: string) => `usr_${c.repeat(26)}` as UserId;
const PEOPLE: Record<string, RequestUser> = {
  "approver-token": { user_id: uid("6"), name: "Approver", email: "a@example.test", role: "approver", synthetic: true, request_id: "r" },
  "approver2-token": { user_id: uid("7"), name: "Approver2", email: "b@example.test", role: "approver", synthetic: true, request_id: "r" },
  "reviewer-token": { user_id: uid("4"), name: "Reviewer", email: "c@example.test", role: "reviewer", synthetic: true, request_id: "r" },
} as never;
const APPROVER = PEOPLE["approver-token"]!.user_id;

class Roles implements SessionResolver {
  async require(token: string | null, request_id: string): Promise<RequestUser> {
    const p = token === null ? undefined : PEOPLE[token];
    if (!p) throw new CoreRefusal("UNAUTHENTICATED", "Sign in again.");
    return { ...p, request_id } as RequestUser;
  }
}

class FakeCollab {
  mode_calls: ModeCommand[] = [];
  fail_mode = false;
  async set_mode(c: ModeCommand) {
    this.mode_calls.push(c);
    if (this.fail_mode) throw new Error("synthetic set_mode failure");
    return { lesson_id: c.lesson_id, mode: c.mode, connections_notified: 0 };
  }
}

let t: TestDb;
let lessons: PgLessonRepo;
let collab: FakeCollab;
let fail_event = false;
let fail_metrics = false;
let n = 0;

// Stand-ins that throw on demand, delegating to the real Postgres repos.
class FlakyLessons extends PgLessonRepo {
  override async append_review_event(e: NewReviewEvent, tx: Tx): Promise<ReviewEventRow> {
    if (fail_event) throw new Error("synthetic review_event failure");
    return super.append_review_event(e, tx);
  }
}
class FlakyMetrics extends PgMetricsRepo {
  override async write_lesson_metrics(...a: Parameters<PgMetricsRepo["write_lesson_metrics"]>) {
    if (fail_metrics) throw new Error("synthetic metrics failure");
    return super.write_lesson_metrics(...a);
  }
}

const count = (sql: string, v: unknown[] = []) =>
  t.db.with_tx(async (tx) => Number((await tx.query<{ n: string }>(sql, v)).rows[0]!.n));
const state_of = (id: string) =>
  t.db.with_tx(async (tx) => (await tx.query<{ state: string }>("select state from lesson where id=$1", [id])).rows[0]!.state);

const stored = (lesson_id: string, text: string): StoredLesson =>
  ({
    lesson_id, schema_version: 1, title: "T", type: "Reading",
    front_matter: { standards: [], minutes_total: 50, vocabulary: [] },
    sections: [{ address: "a", name: "Open", minutes: 5, content: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text }] }] } }],
    text_cards: [],
  }) as unknown as StoredLesson;
const prov = (): ProvenanceRecord => ({
  outline_row_hash: HASH, prompt_version_id: "pv1", model: "m", parameters: {}, schema_version: 1,
  example_set_id: null, run_id: null as never, model_call_ids: [], cost_usd: new Decimal("0.5"),
  ai_assisted_spans: 0, derived_from_version_id: null,
});

// A fresh lesson in state "submitted" with a submit snapshot; returns its id and the pin.
async function submitted_lesson(): Promise<{ id: LessonId; hash: string }> {
  n += 1;
  const id = `${UNIT}.L${n}` as LessonId;
  const hash = n.toString(16).padStart(64, "0");
  const row = { kind: "lesson", lesson_id: id, number: n, title: `Title ${n}`, lesson_type: "core" } as unknown as NormalizedRow;
  await t.db.with_tx(async (tx) => {
    await lessons.ensure_lessons([row], UNIT, tx);
    await lessons.write_generated_version(
      { lesson_id: id, unit_id: UNIT, kind: "generated", lesson: stored(id, "x"), draft: {} as LessonDraft, content_hash: hash, provenance: prov(), idempotency_key: `k-${id}` },
      tx,
    );
    await lessons.write_snapshot(
      { lesson_id: id, kind: "submit", lesson: stored(id, "x"), content_hash: hash, state_vector: VEC, dependency_record: [], created_by: uid("5") },
      tx,
    );
    await lessons.set_state(id, "submitted", null, tx);
  });
  return { id, hash };
}

const approve_req = (id: string, hash: string, token = "approver-token"): HttpRequest => ({
  method: "POST", path_params: { lessonId: id }, query: {}, headers: { origin: APP_ORIGIN },
  body: { action: "approve", snapshot_hash: hash, snapshot_state_vector: VEC, rating: "usable_with_edits" } as never,
  cookies: { ls_session: token },
});
const move_req = (id: string, body: unknown, token: string): HttpRequest => ({
  method: "POST", path_params: { lessonId: id }, query: {}, headers: { origin: APP_ORIGIN }, body: body as never, cookies: { ls_session: token },
});
const code_of = (r: HttpResponse) => (r.body as { error?: { code?: string } } | null)?.error?.code;

let handlers: ReturnType<typeof make_transition_handlers>;

beforeAll(async () => {
  t = await create_test_db({ pool_max: 8 });
  const shared = { db: t.db, ids, clock: new FakeClock(new Date("2026-10-25T10:00:00.000Z")) };
  lessons = new FlakyLessons(shared);
  collab = new FakeCollab();
  const approvals = new ApproveService(
    lessons, lessons, lessons, new PgIssueRepo(shared), new PgSuggestionRepo(shared),
    { load: async () => ({}) } as unknown as CheckContextLoader,
    new MetricsWriter(new FlakyMetrics(shared), { four_eyes_enabled: true } as never, shared.clock),
    t.db, shared.clock, { four_eyes_enabled: true }, [],
  );
  const logger = { error: () => undefined, warn: () => undefined, info: () => undefined, debug: () => undefined };
  const transitions = new TransitionService(lessons, lessons, approvals, collab as unknown as CollabCommands, t.db, logger as never);
  handlers = make_transition_handlers({
    with_route: make_with_route(make_deps({ sessions: () => new Roles() }).deps),
    transitions: () => transitions as never,
  });
});
afterAll(async () => {
  await t.drop();
});

describe("NL-53 transitions against real Postgres", () => {
  it("two parallel approves: one 200, one 409 INVALID_TRANSITION, one version, event and metrics row", async () => {
    const { id, hash } = await submitted_lesson();
    const [a, b] = await Promise.all([
      handlers.transition_lesson(approve_req(id, hash, "approver-token")),
      handlers.transition_lesson(approve_req(id, hash, "approver2-token")),
    ]);
    expect([a.status, b.status].sort()).toEqual([200, 409]);
    const loser = a.status === 409 ? a : b;
    expect(code_of(loser)).toBe("INVALID_TRANSITION");
    expect(await state_of(id)).toBe("approved");
    expect(await count("select count(*) n from lesson_version where lesson_id=$1 and kind='approve'", [id])).toBe(1);
    expect(await count("select count(*) n from review_event where lesson_id=$1 and to_state='approved'", [id])).toBe(1);
    expect(await count("select count(*) n from lesson_metrics where lesson_id=$1", [id])).toBe(1);
  });

  it("rollback: a failing review_event insert, metrics write or set_mode leaves state, versions and events unchanged", async () => {
    const snapshot = async (id: string) => ({
      state: await state_of(id),
      versions: await count("select count(*) n from lesson_version where lesson_id=$1", [id]),
      events: await count("select count(*) n from review_event where lesson_id=$1", [id]),
      metrics: await count("select count(*) n from lesson_metrics where lesson_id=$1", [id]),
    });

    const a = await submitted_lesson();
    const before_a = await snapshot(a.id);
    fail_event = true;
    const r1 = await handlers.transition_lesson(approve_req(a.id, a.hash));
    fail_event = false;
    expect(r1.status).toBeGreaterThanOrEqual(500);
    expect(await snapshot(a.id)).toEqual(before_a);

    fail_metrics = true;
    const r2 = await handlers.transition_lesson(approve_req(a.id, a.hash));
    fail_metrics = false;
    expect(r2.status).toBeGreaterThanOrEqual(500);
    expect(await snapshot(a.id)).toEqual(before_a);

    // set_mode runs last inside the move transaction: request_changes unfreezes the editor.
    const b = await submitted_lesson();
    const before_b = await snapshot(b.id);
    collab.fail_mode = true;
    const r3 = await handlers.transition_lesson(
      move_req(b.id, { action: "request_changes", tag: "standards", note: "synthetic note" }, "approver-token"),
    );
    collab.fail_mode = false;
    expect(r3.status).toBeGreaterThanOrEqual(500);
    expect(await snapshot(b.id)).toEqual(before_b);

    // The same call succeeds once nothing is failing, so the earlier refusals were the injected faults.
    expect((await handlers.transition_lesson(approve_req(a.id, a.hash))).status).toBe(200);
  });

  it("four-eyes: content stored through the real doc store by the approver cannot be approved by that approver", async () => {
    const { id, hash } = await submitted_lesson();
    const store = new PgLessonDocStore({
      db: t.db, ids, clock: new FakeClock(new Date("2026-10-25T10:05:00.000Z")),
      checks: new PgCheckQueue({ db: t.db, ids, clock: new FakeClock(new Date()) }),
      states: lessons,
      audit: new PgAuditLog({ db: t.db, ids, clock: new FakeClock(new Date()) }),
    });
    const lesson = stored(id, "edited by the approver");
    const bytes = lesson_to_ydoc(lesson);
    await store.store({
      lesson_id: id, ydoc_bytes: bytes, derived: lesson, content_hash: content_hash(lesson) as never,
      state_vector: state_of_bytes(bytes), stored_by: APPROVER, request_id: "req_four_eyes" as RequestId, tag: "test",
    });
    expect(await count("select count(*) n from lesson where id=$1 and last_editor_id=$2", [id, APPROVER])).toBe(1);

    const before = await count("select count(*) n from lesson_version where lesson_id=$1", [id]);
    const r = await handlers.transition_lesson(approve_req(id, hash, "approver-token"));
    expect(r.status).toBe(422); // FOUR_EYES maps to 422 in error-status.generated.ts
    expect(code_of(r)).toBe("FOUR_EYES");
    expect(await state_of(id)).toBe("submitted");
    expect(await count("select count(*) n from lesson_version where lesson_id=$1", [id])).toBe(before);

    // A different approver is not blocked by the four-eyes rule.
    expect((await handlers.transition_lesson(approve_req(id, hash, "approver2-token"))).status).toBe(200);
  });
});

function state_of_bytes(bytes: Uint8Array): StateVector {
  return state_vector_of(bytes) as StateVector;
}
