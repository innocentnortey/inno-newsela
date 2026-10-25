// NL-49 AC-8: the runner against real Postgres.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { FakeClock } from "@ls/core/ports/clock";
import { PrefixedIdGenerator } from "@ls/core/ports/ids";
import { create_test_db, type TestDb } from "@ls/db/testing/test-db";
import { PgEvidenceRepo } from "@ls/db/repos/evidence";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { make_fixture_suite } from "./fixture-suite.ts";
import { EvalRunner } from "./runner.ts";

let t: TestDb;
let root: string;
beforeAll(async () => {
  t = await create_test_db();
  root = fs.mkdtempSync(path.join(os.tmpdir(), "nl49-"));
});
afterAll(async () => {
  await t.drop();
  fs.rmSync(root, { recursive: true, force: true });
});

describe("EvalRunner on Postgres", () => {
  it("one eval_case_result per case with a source, and the run is finished", async () => {
    const clock = new FakeClock();
    const evidence = new PgEvidenceRepo({ db: t.db, ids: new PrefixedIdGenerator(), clock });
    const runner = new EvalRunner(evidence, [make_fixture_suite()], clock, { repo_root: root, prompt_version_id: null, models: { generation: "m" }, env: {} });
    const s = await runner.run("S1", { repeat: 1, provider_mode: "stub", git_sha: "abc123def456", unit: null });
    const q = async (sql: string) => t.db.with_tx(async (tx) => (await tx.query<Record<string, unknown>>(sql, [s.eval_run_id])).rows);
    expect(Number((await q("SELECT count(*)::int AS n FROM eval_case_result WHERE eval_run_id=$1"))[0]?.["n"])).toBe(2);
    expect(Number((await q("SELECT count(*)::int AS n FROM eval_case_result WHERE eval_run_id=$1 AND source <> ''"))[0]?.["n"])).toBe(2);
    expect((await q("SELECT * FROM eval_run WHERE id=$1"))[0]).toMatchObject({ passed: 2, total: 2, report_path: s.report_path });
  });
});
