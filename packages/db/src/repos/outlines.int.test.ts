// @vitest-environment node
// NL-26 (implementer-written): AC-10 concurrency, AC-11 row_context and stubs, round trip, standards index.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { FakeClock } from "@ls/core/ports/clock";
import { PrefixedIdGenerator } from "@ls/core/ports/ids";
import { compute_lesson_links } from "@ls/core/intake/lesson-links";
import { load_standards_index } from "@ls/core/intake/standards-index";
import { normalize_outline } from "@ls/core/intake/normalize";
import { load_issued_grid } from "../../../core/tests/fixtures/outline/index.ts";
import { create_test_db, type TestDb } from "../testing/test-db.ts";
import { insert_row } from "../testing/insert-row.ts";
import { seed_standards, seed_users } from "../testing/outline-seed.ts";
import { PgOutlineRepo, PgStandardRepo, row_hash_of } from "./outlines.ts";

let tdb: TestDb;
let repo: PgOutlineRepo;
let standards: PgStandardRepo;
const outline = () => normalize_outline(load_issued_grid(), load_standards_index(), 200);
const USER = "usr_synthetic_author";
const NEW = (sha: string) => ({ unit_id: "G6.U4", sha256: sha, source_kind: "upload_csv" as const, source_name: "x.csv", uploaded_by: USER });
const sha = (c: string) => c.repeat(64);

beforeAll(async () => {
  tdb = await create_test_db();
  const deps = { db: tdb.db, ids: new PrefixedIdGenerator(), clock: new FakeClock() };
  repo = new PgOutlineRepo(deps);
  standards = new PgStandardRepo(deps);
  await seed_users(tdb.db, [{ id: USER, name: "Test author" }]);
}, 60_000);
afterAll(async () => {
  await tdb?.drop();
});

describe("NL-26 AC-10", () => {
  it("concurrent_versions: five parallel inserts for one unit get numbers 1..5, and the unit list shows five newest first", async () => {
    const o = outline();
    const links = compute_lesson_links(o.rows);
    const rows = await Promise.all(
      [1, 2, 3, 4, 5].map((i) => tdb.db.with_tx((tx) => repo.insert_version(NEW(sha(String(i))), o, links, tx))),
    );
    expect(rows.map((r) => r.number).sort()).toEqual([1, 2, 3, 4, 5]);
    expect(new Set(rows.map((r) => r.outline_version_id)).size).toBe(5);
    const overview = await repo.unit_overview();
    expect(overview[0]?.versions.map((v) => v.version.number)).toEqual([5, 4, 3, 2, 1]);
    expect(overview[0]?.versions[0]?.created_by).toBe("Test author");
    expect((await repo.list_units())[0]?.latest_outline_version_id).toBe("G6.U4.ov5");
  });
});

describe("NL-26 AC-11", () => {
  it("row_context: stored choices, given choices, neighbours, links", async () => {
    const id = "G6.U4.ov1";
    const lessons = (await repo.rows(id)).filter((r) => r.row.kind === "lesson");
    const target = lessons[3]!.row;
    await tdb.db.with_tx((tx) => insert_row(tx, "intake_choice", { outline_version_id: id, finding_id: "f1", choice: "keep", status: "default" }));
    const ctx = await repo.row_context(id, target.lesson_id!, null);
    expect(ctx.row).toEqual(target);
    expect(ctx.row_hash).toBe(row_hash_of(target));
    expect(ctx.neighbours).toHaveLength(2);
    expect(ctx.neighbours.every((n) => n.row_number !== target.row_number)).toBe(true);
    expect(ctx.choices.map((c) => c.finding_id)).toEqual(["f1"]);
    const given = [{ ...ctx.choices[0]!, finding_id: "g1" }, { ...ctx.choices[0]!, finding_id: "other", outline_version_id: "G6.U4.ov2" }];
    const ctx2 = await repo.row_context(id, target.lesson_id!, given);
    expect(ctx2.choices.map((c) => c.finding_id)).toEqual(["g1"]);
    await expect(repo.row_context(id, "G6.U4.L99", null)).rejects.toMatchObject({ name: "InvariantViolation" });
  });

  it("roundtrip: rows() and outline() equal the normalizer output", async () => {
    const o = outline();
    expect((await repo.rows("G6.U4.ov1")).map((r) => r.row)).toEqual(o.rows);
    expect(await repo.outline("G6.U4.ov1")).toEqual(o);
  });

  it("links_roundtrip: stored links come back as the computed ones", async () => {
    expect(await repo.links("G6.U4.ov1")).toEqual(compute_lesson_links(outline().rows));
  });

  it("row_hash_ignores_row_number", () => {
    const r = outline().rows[3]!;
    expect(row_hash_of({ ...r, row_number: r.row_number + 10 })).toBe(row_hash_of(r));
    expect(row_hash_of({ ...r, title: r.title + "!" })).not.toBe(row_hash_of(r));
  });
});

describe("NL-26 standards", () => {
  it("standard_index_empty_refuses", async () => {
    await expect(standards.index()).rejects.toMatchObject({ name: "InvariantViolation" });
  });
  it("standard_index_has_eld_verdicts and texts_in_order", async () => {
    await seed_standards(tdb.db);
    const idx = await standards.index();
    expect(idx.resolve("ELD.PII.6.5", "Use transitions to connect ideas").eld_label_mismatch).toBe(true);
    const rows = await standards.texts(["RI.6.2", "NOPE", "RI.6.1"]);
    expect(rows.map((r) => r.code)).toEqual(["RI.6.2", "RI.6.1"]);
  });
});
