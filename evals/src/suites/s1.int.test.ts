// NL-84
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { FakeClock } from "@ls/core/ports/clock";
import { PrefixedIdGenerator } from "@ls/core/ports/ids";
import { PgEvidenceRepo } from "@ls/db/repos/evidence";
import { create_test_db, type TestDb } from "@ls/db/testing/test-db";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { EvalRunner } from "../runner.ts";
import { make_s1 } from "./s1.ts";

let t: TestDb;
let root: string;
beforeAll(async () => {
  t = await create_test_db();
  root = fs.mkdtempSync(path.join(os.tmpdir(), "nl84-"));
});
afterAll(async () => {
  await t.drop();
  fs.rmSync(root, { recursive: true, force: true });
});

describe("S1 on Postgres", () => {
  it("model_call_rows_zero_after_run", async () => {
    const clock = new FakeClock();
    const evidence = new PgEvidenceRepo({ db: t.db, ids: new PrefixedIdGenerator(), clock });
    const suite = make_s1("stub");
    const runner = new EvalRunner(evidence, [suite], clock, { repo_root: root, prompt_version_id: null, models: { generation: "m" }, env: {} });
    const s = await runner.run("S1", { repeat: 1, provider_mode: "stub", git_sha: "abc123def456", unit: null });
    const n = async (sql: string, args: unknown[] = []) => t.db.with_tx(async (tx) => Number((await tx.query<Record<string, unknown>>(sql, args)).rows[0]?.["n"]));
    expect(await n("SELECT count(*)::int AS n FROM model_call")).toBe(0);
    expect(await n("SELECT count(*)::int AS n FROM eval_case_result WHERE eval_run_id=$1", [s.eval_run_id])).toBe(suite.cases().length);
    expect(s.passed).toBe(s.total);
  });
});
