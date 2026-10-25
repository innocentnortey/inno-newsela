// NL-51 AC-8 (WF-19 capture): real Postgres, real repos, real handlers.
import { createHash } from "node:crypto";
import Decimal from "decimal.js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { FakeClock } from "@ls/core/ports/clock";
import { PrefixedIdGenerator } from "@ls/core/ports/ids";
import type { RequestUser } from "@ls/core/ports/common";
import type { ProvenanceRecord } from "@ls/core/ports/lesson-versions";
import { PgAuditLog } from "@ls/db/repos/audit";
import { PgExportRepo } from "@ls/db/repos/exports";
import { PgLessonRepo } from "@ls/db/repos/lessons";
import { insert_row } from "@ls/db/testing/insert-row";
import { create_test_db, type TestDb } from "@ls/db/testing/test-db";
import { canonical_json } from "@ls/schema/content-hash";
import type { LessonDraft } from "@ls/schema/lesson-draft";
import type { StoredLesson } from "@ls/schema/lesson";
import type { NormalizedRow } from "@ls/schema/outline";
import { DomainRefusal, APP_ORIGIN, make_deps } from "@/server/http/testing/route-fixtures.ts";
import { make_with_route, type HttpRequest, type SessionResolver } from "@/server/http/with-route.ts";
import { ExportService } from "@/server/services/export-service.ts";
import { make_export_handlers, type ExportApi } from "../../../exports/http.ts";

const UNIT = "G6.U4";
const L4 = "G6.U4.L4";
const L5 = "G6.U4.L5";
const HASH = "a".repeat(64);
const ids = new PrefixedIdGenerator();
const APPROVER = ids.new_id("usr");

class Roles implements SessionResolver {
  async require(token: string | null, request_id: string): Promise<RequestUser> {
    if (token === "approver-token") {
      return { user_id: APPROVER, name: "Test approver", email: "approver@example.test", role: "approver", synthetic: true, request_id } as RequestUser;
    }
    throw new DomainRefusal("UNAUTHENTICATED", "Sign in again.");
  }
}

let t: TestDb;
let lessons: PgLessonRepo;
let h: ReturnType<typeof make_export_handlers>;

const lesson_row = (id: string, n: number): NormalizedRow =>
  ({ kind: "lesson", lesson_id: id, number: n, title: `Title ${n}`, lesson_type: "core" }) as unknown as NormalizedRow;
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

async function approve(lesson_id: string, text: string, hash: string) {
  await t.db.with_tx(async (tx) => {
    await lessons.write_generated_version(
      { lesson_id, unit_id: UNIT, kind: "generated", lesson: stored(lesson_id, text), draft: {} as LessonDraft, content_hash: hash, provenance: prov(), idempotency_key: "k-" + lesson_id },
      tx,
    );
    await lessons.write_snapshot(
      { lesson_id, kind: "approve", lesson: stored(lesson_id, text), content_hash: hash, state_vector: Buffer.from([1]).toString("base64"), dependency_record: [], created_by: APPROVER },
      tx,
    );
    await lessons.set_state(lesson_id, "approved", null, tx);
  });
}

const req = (method: string, params: Record<string, string>): HttpRequest => ({
  method,
  path_params: params,
  query: {},
  headers: method === "POST" ? { origin: APP_ORIGIN } : {},
  body: null,
  cookies: { ls_session: "approver-token" },
});
const count = (sql: string) => t.db.with_tx(async (tx) => Number((await tx.query<{ n: string }>(sql)).rows[0]!.n));

beforeAll(async () => {
  t = await create_test_db({ pool_max: 6 });
  const shared = { db: t.db, ids, clock: new FakeClock(new Date("2026-10-01T10:00:00.000Z")) };
  lessons = new PgLessonRepo(shared);
  await t.db.with_tx(async (tx) => {
    await lessons.ensure_lessons([lesson_row(L4, 4), lesson_row(L5, 5)], UNIT, tx);
    await insert_row(tx, "outline_version", { id: "ov-nl51", unit_id: UNIT, number: 1 });
    await insert_row(tx, "lesson_link", { outline_version_id: "ov-nl51", from_lesson_id: L4, to_lesson_id: L5, kind: "excerpt_slot", slot_id: "L5.excerpt_1" });
  });
  await approve(L5, "five", "5".repeat(64));
  await approve(L4, "four", "4".repeat(64));
  const svc = new ExportService(
    lessons,
    new PgExportRepo(shared),
    new PgAuditLog(shared),
    t.db,
    ids,
    shared.clock,
    lessons,
    lessons,
    { list_units: async () => [{ unit_id: UNIT, grade: 6, title: "Unit 4", latest_outline_version_id: null }] },
  );
  h = make_export_handlers({ with_route: make_with_route(make_deps({ sessions: () => new Roles() }).deps), exports: () => svc as unknown as ExportApi });
});
afterAll(async () => {
  await t.drop();
});

describe("AC-8 test_export_capture", () => {
  it("test_export_capture: 201 then 200, one bundle, one audit event, snapshot hashes match the file", async () => {
    const first = await h.create_export(req("POST", { unitId: UNIT }));
    expect(first.status).toBe(201);
    const second = await h.create_export(req("POST", { unitId: UNIT }));
    expect(second.status).toBe(200);
    const a = first.body as { export_id: string };
    const b = second.body as { export_id: string; same_as_previous: boolean };
    expect(b.same_as_previous).toBe(true);
    expect(b.export_id).toBe(a.export_id);
    expect(await count("select count(*) n from export_bundle")).toBe(1);
    expect(await count("select count(*) n from audit_event where action='export.create'")).toBe(1);
    expect(await count("select count(*) n from review_event where from_state='approved' and to_state='exported'")).toBe(2);

    const listed = (await h.list_exports(req("GET", { unitId: UNIT }))).body as { exports: Array<{ payload_hash: string }> };
    const dl = await h.download_export(req("GET", { exportId: a.export_id }));
    expect(dl.status).toBe(200);
    expect(createHash("sha256").update(canonical_json(dl.body), "utf8").digest("hex")).toBe(listed.exports[0]!.payload_hash);

    const file = dl.body as { lessons: Array<{ version_id: string; content_hash: string }> };
    const joined = await t.db.with_tx(async (tx) =>
      (await tx.query("select b.id, v.id as vid, v.content_hash, v.kind from export_bundle b, jsonb_array_elements_text(b.lesson_versions_json) e join lesson_version v on v.id = e")).rows,
    );
    expect(joined).toHaveLength(2);
    for (const r of joined as Array<{ vid: string; content_hash: string; kind: string }>) {
      expect(r.kind).toBe("approve");
      expect(file.lessons.find((l) => l.version_id === r.vid)?.content_hash).toBe(r.content_hash);
    }
  });

  it("test_export_capture: two concurrent creates after a change give one 201 and one 200", async () => {
    await approve(L5, "five changed", "6".repeat(64));
    const [x, y] = await Promise.all([h.create_export(req("POST", { unitId: UNIT })), h.create_export(req("POST", { unitId: UNIT }))]);
    expect([x.status, y.status].sort()).toEqual([200, 201]);
    expect(await count("select count(*) n from export_bundle")).toBe(2);
  });
});
