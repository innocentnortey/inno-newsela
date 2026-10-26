// The inventory query against the test Postgres: pinned prompt version, locked hash, queued vs running, latent backlog, read-only.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { insert_row } from "../packages/db/src/testing/insert-row.ts";
import { create_test_db, type TestDb } from "../packages/db/src/testing/test-db.ts";
import { FakeClock } from "../packages/core/src/ports/clock.ts";
import { PrefixedIdGenerator } from "../packages/core/src/ports/ids.ts";
import { PgJobQueue } from "../packages/db/src/repos/job-queue.ts";
import { main, read_inventory } from "./queue-compat.ts";

const A = "a".repeat(64);
const B = "b".repeat(64);
let t: TestDb;
const NOW = new Date("2026-10-26T12:00:00.000Z");

async function seed(): Promise<void> {
  await t.db.with_tx(async (tx) => {
    await insert_row(tx, "prompt_version", { id: "pv_old", locked_hash: A, number: 1 });
    await insert_row(tx, "prompt_version", { id: "pv_new", locked_hash: B, number: 2 });
    await insert_row(tx, "prompt_version", { id: "pv_guid", locked_hash: B, number: 3 }); // same locked layer, different guidance
    const runs: Array<[string, string, string]> = [
      ["run_old_running", "running", "pv_old"], ["run_old_paused", "paused", "pv_old"], ["run_new", "running", "pv_new"], ["run_guid", "running", "pv_guid"],
      ["run_done", "complete", "pv_old"], ["run_cancelled", "cancelled", "pv_old"], ["run_partial", "partial", "pv_old"], ["run_gone", "running", "pv_gone"],
    ];
    for (const [id, state, pv] of runs) await insert_row(tx, "run", { id, state, prompt_version_id: pv, idempotency_key: id, started_by: "u" });
    const jobs: Array<[string, string, string, string]> = [
      ["j1", "run_old_running", "queued", "lesson"], ["j2", "run_old_running", "running", "lesson"], ["j3", "run_old_paused", "queued", "lesson"],
      ["j4", "run_new", "queued", "lesson"], ["j5", "run_guid", "running", "lesson"], ["j6", "run_gone", "queued", "lesson"],
      ["j7", "run_new", "queued", "unit_plan"], ["j8", "run_new", "queued", "candidate"],
      ["j9", "run_done", "ready", "lesson"], ["j10", "run_partial", "generation_failed", "lesson"], ["j11", "run_cancelled", "cancelled", "lesson"],
    ];
    for (const [id, run_id, status, kind] of jobs) await insert_row(tx, "lesson_job", { id, run_id, status, kind, lesson_id: kind === "lesson" ? `G6.U4.${id}` : null });
  });
}
const counts = async () => (await t.db.with_tx(async (tx) => (await tx.query(
  "select (select count(*) from lesson_job)::int j, (select count(*) from run)::int r, (select count(*) from prompt_version)::int p")).rows[0])) as { j: number; r: number; p: number };

beforeAll(async () => {
  t = await create_test_db();
  expect(t.url).toContain("127.0.0.1"); // create succeeded on the test Postgres
  await seed();
}, 60_000);
afterAll(async () => {
  await t?.drop();
});

describe("queue-compat inventory query", () => {
  it("inventory_query_lists_queued_and_running_only", async () => {
    const inv = await read_inventory(t.db, B, { now: NOW, include_failed: false });
    const ids = inv.jobs.map((j) => j.job_id).sort();
    expect(ids).toEqual(["j1", "j2", "j3", "j4", "j5", "j6", "j7", "j8"]);
    expect(inv.jobs.every((j) => j.status === "queued" || j.status === "running")).toBe(true);
    expect(inv.latest_prompt_version).toEqual({ id: "pv_guid", number: 3, locked_hash: B });
  });

  it("inventory_query_groups_by_locked_hash_not_by_version_id", async () => {
    const inv = await read_inventory(t.db, B, { now: NOW, include_failed: false });
    const match = inv.groups.find((g) => g.compat === "match")!;
    expect([...match.prompt_version_ids].sort()).toEqual(["pv_guid", "pv_new"]);
    expect(match.locked_hash).toBe(B);
    expect(inv.groups.find((g) => g.compat === "old_pin")).toMatchObject({ locked_hash: A, prompt_version_ids: ["pv_old"] });
    expect(inv.groups.find((g) => g.compat === "pin_missing")).toMatchObject({ locked_hash: null, prompt_version_ids: ["pv_gone"] });
    expect(inv.totals).toEqual({ match: 4, old_pin: 3, pin_missing: 1 });
    // The same database read against the OLD artifact flips the verdicts: what the old image can still finish.
    const old = await read_inventory(t.db, A, { now: NOW, include_failed: false });
    expect(old.totals).toEqual({ match: 3, old_pin: 4, pin_missing: 1 });
  });

  it("inventory_counts_latent_backlog", async () => {
    const inv = await read_inventory(t.db, B, { now: NOW, include_failed: false });
    const j3 = inv.jobs.find((j) => j.job_id === "j3")!;
    expect(j3).toMatchObject({ run_state: "paused", claimable_now: false, status: "queued" });
    const old = inv.groups.find((g) => g.compat === "old_pin")!;
    expect(old).toMatchObject({ queued: 2, running: 1, queued_in_unclaimable_runs: 1 });
    expect(inv.jobs.find((j) => j.job_id === "j1")!.claimable_now).toBe(true);
  });

  it("inventory_includes_unit_plan_and_candidate_jobs", async () => {
    const inv = await read_inventory(t.db, B, { now: NOW, include_failed: false });
    expect(inv.jobs.filter((j) => ["j7", "j8"].includes(j.job_id)).map((j) => j.kind).sort()).toEqual(["candidate", "unit_plan"]);
  });

  it("retryable_failed_only_with_flag", async () => {
    expect((await read_inventory(t.db, B, { now: NOW, include_failed: false })).retryable_failed).toEqual([]);
    const inv = await read_inventory(t.db, B, { now: NOW, include_failed: true });
    expect(inv.retryable_failed).toEqual([{ job_id: "j10", run_id: "run_partial", lesson_id: "G6.U4.j10", pinned_locked_hash: A, compat: "old_pin" }]);
  });

  it("inventory_is_read_only", async () => {
    const before = await counts();
    await main(["--json", "--include-failed"], { DATABASE_URL: t.url }, { out: () => undefined, err: () => undefined });
    expect(await counts()).toEqual(before);
    // The guard the CLI relies on: inside the read-only transaction a write is refused by Postgres itself (SQLSTATE 25006).
    await expect(t.db.with_tx(async (tx) => {
      await tx.query("SET TRANSACTION READ ONLY");
      await tx.query("UPDATE lesson_job SET attempt = attempt");
    })).rejects.toMatchObject({ code: "25006" });
  });

  it("main_reports_and_hides_credentials", async () => {
    const out: string[] = [], err: string[] = [];
    const code = await main(["--json", "--artifact-hash", B], { DATABASE_URL: t.url }, { out: (s) => void out.push(s), err: (s) => void err.push(s) });
    expect(code).toBe(0);
    const text = out.join("");
    const parsed = JSON.parse(text) as { totals: unknown; artifact_locked_hash: string };
    expect(parsed.artifact_locked_hash).toBe(B);
    expect(parsed.totals).toEqual({ match: 4, old_pin: 3, pin_missing: 1 });
    expect(text + err.join("")).not.toContain(t.url);
    expect(text + err.join("")).not.toContain("ls_dev_only");
  });

  it("fail_on_old_returns_3", async () => {
    const io = { out: () => undefined, err: () => undefined };
    expect(await main(["--fail-on-old", "--artifact-hash", B], { DATABASE_URL: t.url }, io)).toBe(3);
    expect(await main(["--artifact-hash", B], { DATABASE_URL: t.url }, io)).toBe(0);
  });

  // Last: it claims j7/j8, which only moves them from queued to running inside the "match" group.
  it("pin_aware_worker_leaves_the_stranded_jobs_and_the_inventory_still_reports_them", async () => {
    const w = new PgJobQueue({ db: t.db, ids: new PrefixedIdGenerator(), clock: new FakeClock(NOW) }, { mode: "locked_hash", locked_hash: B });
    const claimed: string[] = [];
    for (let c = await w.claim("w", 10, 1000); c !== null; c = await w.claim("w", 10, 1000)) claimed.push(c.job_id);
    expect(claimed.sort()).toEqual(["j7", "j8"]); // only the matching-pin runnable jobs; j1, j3 (old pin) and j6 (no row) stay
    const rep = await w.other_pin_report();
    expect(rep).toMatchObject({ queued_other_pin: 2, queued_other_pin_live: 1, queued_pin_missing: 1, other_hashes: [A.slice(0, 12)] });
    const inv = await read_inventory(t.db, B, { now: NOW, include_failed: false });
    const stranded = inv.jobs.filter((j) => j.status === "queued" && j.compat !== "match").map((j) => j.job_id).sort();
    expect(stranded).toEqual(["j1", "j3", "j6"]); // same jobs the worker reports: queued_other_pin + queued_pin_missing = 3
    expect(rep.queued_other_pin + rep.queued_pin_missing).toBe(stranded.length);
    const rows = await t.db.with_tx(async (tx) => (await tx.query("select id, status, attempt from lesson_job where id in ('j1','j3','j6') order by id")).rows);
    expect(rows).toEqual([{ id: "j1", status: "queued", attempt: 0 }, { id: "j3", status: "queued", attempt: 0 }, { id: "j6", status: "queued", attempt: 0 }]);
  });
});
