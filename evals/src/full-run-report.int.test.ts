// NL-86 AC-9 (fallback form, plan section 6): the builder's eval_run row on real Postgres agrees with the file.
// Seeding a whole run through the repos costs far more than 60 lines, so the read ports are the seeded fakes and only the evidence rows are real.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { FakeClock } from "@ls/core/ports/clock";
import { PrefixedIdGenerator } from "@ls/core/ports/ids";
import { PgEvidenceRepo } from "@ls/db/repos/evidence";
import { create_test_db, type TestDb } from "@ls/db/testing/test-db";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { build_full_run_report_detailed } from "./full-run-report.ts";
import { make_stub_world } from "./testing/full-run-world.ts";

let t: TestDb;
let root: string;
beforeAll(async () => {
  t = await create_test_db();
  root = fs.mkdtempSync(path.join(os.tmpdir(), "nl86-int-"));
});
afterAll(async () => {
  await t.drop();
  fs.rmSync(root, { recursive: true, force: true });
});

describe("full-run report on Postgres", () => {
  it("test_full_run_report_shape: the eval_run row carries run_id, report_path and the lesson count", async () => {
    const world = make_stub_world({ n: 47, seed: 86 });
    const clock = new FakeClock();
    const evidence = new PgEvidenceRepo({ db: t.db, ids: new PrefixedIdGenerator(), clock });
    const d = await build_full_run_report_detailed(world.run_id as never, {
      ports: world.ports, evidence, repo_root: root, git_sha: "abc123def456", prompt_version_id: null, models: { generation: "m" }, provider_mode: "stub", env: {},
    });
    const q = async (sql: string) => t.db.with_tx(async (tx) => (await tx.query<Record<string, unknown>>(sql, [d.eval_run_id])).rows);
    expect((await q("SELECT * FROM eval_run WHERE id=$1"))[0]).toMatchObject({ suite: "S9", run_id: world.run_id, report_path: d.report.report_path, total: 47, passed: 47 });
    expect(Number((await q("SELECT count(*)::int AS n FROM eval_case_result WHERE eval_run_id=$1"))[0]?.["n"])).toBe(47);
    expect(fs.existsSync(path.join(root, d.report.report_path))).toBe(true);
  });
});
