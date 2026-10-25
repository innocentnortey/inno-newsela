// NL-51: PgExportRepo against real Postgres (AC-4 concurrency; round trip; fail-closed payload).
import { createHash } from "node:crypto";
import { FakeClock } from "@ls/core/ports/clock";
import { PrefixedIdGenerator } from "@ls/core/ports/ids";
import Decimal from "decimal.js";
import { InvariantViolation } from "@ls/core/errors";
import type { ProvenanceRecord } from "@ls/core/ports/lesson-versions";
import type { LessonDraft } from "@ls/schema/lesson-draft";
import { canonical_json } from "@ls/schema/content-hash";
import type { ExportBundleFile } from "@ls/schema/export";
import type { StoredLesson } from "@ls/schema/lesson";
import type { NormalizedRow } from "@ls/schema/outline";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { create_test_db, type TestDb } from "../testing/test-db.ts";
import { PgExportRepo } from "./exports.ts";
import { PgLessonRepo } from "./lessons.ts";

let t: TestDb;
let repo: PgExportRepo;
let lessons: PgLessonRepo;
const ids = new PrefixedIdGenerator();
const clock = new FakeClock(new Date("2026-10-01T10:00:00.000Z"));
const USER = ids.new_id("usr");
const UNIT = "G6.U4";
const HASH = "a".repeat(64);

const lesson_row = (id: string, n: number): NormalizedRow =>
  ({ kind: "lesson", lesson_id: id, number: n, title: `Title ${n}`, lesson_type: "core" }) as unknown as NormalizedRow;
const stored = (text: string, lesson_id = "G6.U4.L1"): StoredLesson =>
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

async function approve(lesson_id: string, text: string) {
  await t.db.with_tx((tx) =>
    lessons.write_generated_version(
      { lesson_id, unit_id: UNIT, kind: "generated", lesson: stored(text, lesson_id), draft: {} as LessonDraft, content_hash: HASH, provenance: prov(), idempotency_key: "k-" + lesson_id },
      tx,
    ),
  );
  return t.db.with_tx((tx) =>
    lessons.write_snapshot(
      { lesson_id, kind: "approve", lesson: stored(text, lesson_id), content_hash: HASH, state_vector: Buffer.from([1]).toString("base64"), dependency_record: [], created_by: USER },
      tx,
    ),
  );
}

// Builds a bundle in the same shape the service builds (generated_at = latest stored_at).
async function bundle(version_ids: string[]) {
  const rows = (
    await t.db.with_tx(async (tx) =>
      (await tx.query("SELECT id, lesson_id, content_hash, created_by, stored_at, lesson_json FROM lesson_version WHERE id = ANY($1::text[])", [version_ids])).rows,
    )
  ) as Array<Record<string, any>>;
  const ordered = version_ids.map((v) => rows.find((r) => r["id"] === v)!);
  const payload = {
    export_version: 1,
    unit_id: UNIT,
    generated_at: new Date(Math.max(...ordered.map((r) => (r["stored_at"] as Date).getTime()))).toISOString(),
    lessons: ordered.map((r) => ({
      lesson_id: r["lesson_id"], version_id: r["id"], content_hash: r["content_hash"], approved_by: r["created_by"],
      approved_at: (r["stored_at"] as Date).toISOString(), lesson: r["lesson_json"],
    })),
  } as unknown as ExportBundleFile;
  const sha = createHash("sha256").update(canonical_json(payload), "utf8").digest("hex");
  return { unit_id: UNIT, payload_sha256: sha, lesson_versions: version_ids, held_back: [], payload, created_by: USER };
}

let v1: string;
let v2: string;
let v3: string;

beforeAll(async () => {
  t = await create_test_db({ pool_max: 6 });
  repo = new PgExportRepo({ db: t.db, ids, clock });
  lessons = new PgLessonRepo({ db: t.db, ids, clock });
  await t.db.with_tx((tx) => lessons.ensure_lessons([1, 2, 3].map((n) => lesson_row(`${UNIT}.L${n}`, n)), UNIT, tx));
  v1 = (await approve(`${UNIT}.L1`, "one")).version_id;
  v2 = (await approve(`${UNIT}.L2`, "two")).version_id;
  v3 = (await approve(`${UNIT}.L3`, "three")).version_id;
});
afterAll(async () => {
  await t.drop();
});

describe("PgExportRepo", () => {
  it("insert_latest_all_payload_roundtrip: versions count up, newest first, payload hashes back", async () => {
    expect(await repo.latest(UNIT)).toBeNull();
    const a = await t.db.with_tx(async (tx) => repo.insert(await bundle([v1, v2]), tx));
    const b = await t.db.with_tx(async (tx) => repo.insert(await bundle([v1, v2, v3]), tx));
    expect([a.version_number, b.version_number]).toEqual([1, 2]);
    expect((await repo.latest(UNIT))?.export_id).toBe(b.export_id);
    expect((await repo.all_for_unit(UNIT)).map((r) => r.version_number)).toEqual([2, 1]);
    expect(b.lesson_versions).toEqual([v1, v2, v3]);
    const p = await repo.payload(b.export_id);
    expect(createHash("sha256").update(canonical_json(p), "utf8").digest("hex")).toBe(b.payload_sha256);
    expect(p?.lessons.map((l) => l.version_id)).toEqual([v1, v2, v3]);
  });

  it("payload_unknown_is_null", async () => {
    expect(await repo.payload("exp_" + "0".repeat(26))).toBeNull();
  });

  it("insert_rejects_mismatched_hash_or_versions", async () => {
    const good = await bundle([v1]);
    await expect(t.db.with_tx((tx) => repo.insert({ ...good, payload_sha256: "b".repeat(64) }, tx))).rejects.toBeInstanceOf(InvariantViolation);
    await expect(t.db.with_tx((tx) => repo.insert({ ...good, lesson_versions: [v2] }, tx))).rejects.toBeInstanceOf(InvariantViolation);
  });

  it("payload_detects_drift: a changed hash is never served", async () => {
    const row = await t.db.with_tx(async (tx) => repo.insert(await bundle([v3]), tx));
    await t.db.with_tx((tx) => tx.query("UPDATE export_bundle SET payload_sha256=$2 WHERE id=$1", [row.export_id, "c".repeat(64)]));
    await expect(repo.payload(row.export_id)).rejects.toBeInstanceOf(InvariantViolation);
  });

  it("concurrent_create_serializes: two creators under the unit lock write one row", async () => {
    const unit = "G6.U4";
    await t.db.with_tx((tx) => tx.query("DELETE FROM export_bundle WHERE unit_id=$1", [unit]));
    const b = await bundle([v1, v2]);
    const create = () =>
      t.db.with_tx(async (tx) => {
        const l = await repo.latest(unit);
        if (l && l.payload_sha256 === b.payload_sha256) return { row: l, created: false };
        await new Promise((r) => setTimeout(r, 50));
        return { row: await repo.insert(b, tx), created: true };
      }, "export:" + unit);
    const [x, y] = await Promise.all([create(), create()]);
    const n = await t.db.with_tx(async (tx) => Number((await tx.query("SELECT count(*) n FROM export_bundle WHERE unit_id=$1", [unit])).rows[0]!.n));
    expect(n).toBe(1);
    expect([x.created, y.created].filter(Boolean)).toHaveLength(1);
    expect(x.row.export_id).toBe(y.row.export_id);
  });
});
