// NL-49
import { InvariantViolation } from "@ls/core/errors";
import { FakeClock } from "@ls/core/ports/clock";
import type { OpsEventRecord } from "@ls/core/ports/evidence";
import { PrefixedIdGenerator } from "@ls/core/ports/ids";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { create_test_db, type TestDb } from "../testing/test-db.ts";
import { PgEvidenceRepo } from "./evidence.ts";

let t: TestDb;
let repo: PgEvidenceRepo;
const ids = new PrefixedIdGenerator();
const rows = async (sql: string, values: unknown[] = []): Promise<Record<string, unknown>[]> =>
  t.db.with_tx(async (tx) => (await tx.query<Record<string, unknown>>(sql, values)).rows);

beforeAll(async () => {
  t = await create_test_db();
  repo = new PgEvidenceRepo({ db: t.db, ids, clock: new FakeClock(new Date("2026-10-01T10:00:00.000Z")) });
});
afterAll(async () => {
  await t.drop();
});

const new_run = () =>
  repo.start_eval_run({ suite: "S1", git_sha: "abc123", prompt_version_id: null, models: { generation: "m1" }, provider_mode: "stub", case_set: "cases=2;repeat=1", run_id: null });

describe("PgEvidenceRepo", () => {
  it("eval_run_roundtrip: start then finish", async () => {
    const run = await new_run();
    expect(run.eval_run_id).toMatch(/^ev_/);
    expect(run.finished_at).toBeNull();
    const done = await repo.finish_eval_run(run.eval_run_id, 1, 2, "evals/reports/golden-abc123.md");
    expect(done.finished_at).not.toBeNull();
    const [r] = await rows("SELECT * FROM eval_run WHERE id=$1", [run.eval_run_id]);
    expect(r).toMatchObject({ suite: "S1", git_sha: "abc123", passed: 1, total: 2, report_path: "evals/reports/golden-abc123.md", provider_mode: "stub" });
    expect(r?.["models_json"]).toEqual({ generation: "m1" });
    expect(r?.["finished_at"]).toBeInstanceOf(Date);
  });

  it("case_result_roundtrip: stores all columns and rejects a duplicate case_id", async () => {
    const run = await new_run();
    const rec = { eval_run_id: run.eval_run_id, case_id: "fx-1", provenance: "synthetic" as const, source: "SYN-1", guards: "g", passed: false, failure_category: "x", expected: { a: 1 }, actual: { a: 2 } };
    await repo.add_case_result(rec);
    const [r] = await rows("SELECT * FROM eval_case_result WHERE eval_run_id=$1", [run.eval_run_id]);
    expect(r).toMatchObject({ case_id: "fx-1", provenance: "synthetic", source: "SYN-1", guards: "g", passed: false, failure_category: "x", expected_json: { a: 1 }, actual_json: { a: 2 } });
    await expect(repo.add_case_result(rec)).rejects.toThrow();
  });

  it("probe_run_roundtrip_p95_json", async () => {
    const id = await repo.insert_probe_run({ probe_run_id: "pr_t1", kind: "http", users: 200, duration_s: 900, machine: "m", provider_mode: "stub", p95_ms: { lesson_open: 120, board: 80 }, error_rate: 0.01, lost_updates: 0, event_loop_lag_p95_ms: 12.5, max_db_connections: 9, n: 1000 });
    expect(id).toBe("pr_t1");
    const [r] = await rows("SELECT * FROM probe_run WHERE id=$1", [id]);
    expect(r?.["p95_json"]).toEqual({ lesson_open: 120, board: 80 });
    expect(Number(r?.["error_rate"])).toBe(0.01);
    expect(Number(r?.["event_loop_lag_p95_ms"])).toBe(12.5);
    expect(r).toMatchObject({ kind: "http", users: 200, n: 1000 });
  });

  it("experiment_run_roundtrip", async () => {
    const id = await repo.insert_experiment_run({ experiment_id: "SP-1-a", config: { k: 1 }, result: { ok: true }, report_path: "docs/x.md" });
    const [r] = await rows("SELECT * FROM experiment_run WHERE id=$1", [id]);
    expect(r).toMatchObject({ config_json: { k: 1 }, result_json: { ok: true }, report_path: "docs/x.md" });
  });

  it("ops_event_each_kind", async () => {
    const kinds: OpsEventRecord["kind"][] = ["process.start", "migration.applied", "seed", "backup", "health.failure", "samples.built"];
    for (const kind of kinds) {
      const id = await repo.ops_event({ kind, service: "web", build_id: "b1", details: { n: 1 } });
      const [r] = await rows("SELECT * FROM ops_event WHERE id=$1", [id]);
      expect(r).toMatchObject({ kind, service: "web", build_id: "b1", details_json: { n: 1 } });
    }
  });

  it("finish_unknown_run_throws", async () => {
    await expect(repo.finish_eval_run("ev_missing", 0, 0, "p")).rejects.toBeInstanceOf(InvariantViolation);
  });
});
