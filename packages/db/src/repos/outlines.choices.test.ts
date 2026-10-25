// @vitest-environment node
// NL-77: PgOutlineRepo choice writes, once-only confirmation, gate inputs, name join and runs_from_version.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { FakeClock } from "@ls/core/ports/clock";
import { PrefixedIdGenerator } from "@ls/core/ports/ids";
import { compute_lesson_links } from "@ls/core/intake/lesson-links";
import { load_standards_index } from "@ls/core/intake/standards-index";
import { normalize_outline } from "@ls/core/intake/normalize";
import type { IntakeChoiceRow } from "@ls/schema/outline";
import { load_issued_grid } from "../../../core/tests/fixtures/outline/index.ts";
import { create_test_db, type TestDb } from "../testing/test-db.ts";
import { insert_row } from "../testing/insert-row.ts";
import { seed_users } from "../testing/outline-seed.ts";
import { PgOutlineRepo } from "./outlines.ts";

let tdb: TestDb;
let repo: PgOutlineRepo;
const USER = "usr_synthetic_author";
const ID = "G6.U4.ov1";
const choice = (over: Partial<IntakeChoiceRow>): IntakeChoiceRow =>
  ({ outline_version_id: ID, finding_id: "f_1", choice: "keep", status: "confirmed", confirmed_by: USER, at: "2026-10-25T00:00:00.000Z", ...over }) as IntakeChoiceRow;

beforeAll(async () => {
  tdb = await create_test_db();
  repo = new PgOutlineRepo({ db: tdb.db, ids: new PrefixedIdGenerator(), clock: new FakeClock() });
  await seed_users(tdb.db, [{ id: USER, name: "Test author" }]);
  const o = normalize_outline(load_issued_grid(), load_standards_index(), 200);
  await tdb.db.with_tx((tx) =>
    repo.insert_version({ unit_id: "G6.U4", sha256: "a".repeat(64), source_kind: "upload_csv", source_name: "x.csv", uploaded_by: USER }, o, compute_lesson_links(o.rows), tx),
  );
}, 60_000);
afterAll(async () => {
  await tdb?.drop();
});

describe("NL-77 repo choices", () => {
  it("upsert_choice: insert then overwrite keeps one row; choices() returns the user's name", async () => {
    await tdb.db.with_tx((tx) => repo.upsert_choice(choice({}), tx));
    await tdb.db.with_tx((tx) => repo.upsert_choice(choice({ choice: "remap", status: "default", confirmed_by: null }), tx));
    let rows = await repo.choices(ID);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ finding_id: "f_1", choice: "remap", status: "default", confirmed_by: null });
    await tdb.db.with_tx((tx) => repo.upsert_choice(choice({}), tx));
    rows = await repo.choices(ID);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ choice: "keep", status: "confirmed", confirmed_by: "Test author" });
    const stored = await tdb.db.with_tx(async (tx) => (await tx.query("select confirmed_by from intake_choice")).rows);
    expect(stored).toEqual([{ confirmed_by: USER }]);
  });

  it("upsert_choice and mark_confirmed refuse a non-database transaction", async () => {
    await expect(repo.upsert_choice(choice({}), {})).rejects.toMatchObject({ name: "InvariantViolation" });
    await expect(repo.mark_confirmed(ID, new Date(), {})).rejects.toMatchObject({ name: "InvariantViolation" });
  });

  it("mark_confirmed: sets once; a later call does not move the date", async () => {
    expect((await repo.version(ID))?.confirmed_at).toBeNull();
    await tdb.db.with_tx((tx) => repo.mark_confirmed(ID, new Date("2026-10-25T10:00:00Z"), tx));
    await tdb.db.with_tx((tx) => repo.mark_confirmed(ID, new Date("2026-10-26T10:00:00Z"), tx));
    expect((await repo.version(ID))?.confirmed_at).toBe("2026-10-25T10:00:00.000Z");
    expect((await repo.choices(ID))[0]?.at).toBe("2026-10-25T10:00:00.000Z");
  });

  it("generate_gate_inputs returns the outline and the choices", async () => {
    const g = await repo.generate_gate_inputs(ID);
    expect(g.outline).toEqual(await repo.outline(ID));
    expect(g.choices).toEqual(await repo.choices(ID));
  });

  it("runs_from_version: empty, then newest first", async () => {
    expect(await repo.runs_from_version(ID)).toEqual([]);
    for (const [n, at, hash] of [[1, "2026-10-25T10:00:00Z", "1"], [2, "2026-10-25T11:00:00Z", "2"]] as const) {
      await tdb.db.with_tx((tx) =>
        insert_row(tx, "run", {
          id: `run_synthetic_${n}`, unit_id: "G6.U4", outline_version_id: ID, kind: "full", state: "complete", scope_json: "{}",
          prompt_version_id: "pv_1", choices_json: "[]", choices_hash: hash.repeat(64), cap_usd: 1, idempotency_key: `k${n}`, started_by: USER, created_at: at,
        }),
      );
    }
    expect((await repo.runs_from_version(ID)).map((r) => r.run_id)).toEqual(["run_synthetic_2", "run_synthetic_1"]);
    expect((await repo.runs_from_version(ID))[0]).toMatchObject({ started_at: "2026-10-25T11:00:00.000Z", choices_hash: "2".repeat(64) });
  });
});
