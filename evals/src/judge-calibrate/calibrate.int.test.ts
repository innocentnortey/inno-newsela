// NL-111 AC-7: a run changes nothing in the product tables. The only repo built is the evidence repo.
import { FakeClock } from "@ls/core/ports/clock";
import { PrefixedIdGenerator } from "@ls/core/ports/ids";
import { PgEvidenceRepo } from "@ls/db/repos/evidence";
import { create_test_db, type TestDb } from "@ls/db/testing/test-db";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { run_judge_calibrate } from "./main.ts";
import { FLIP_4, harness, scripted_judge } from "./test-support.ts";

let t: TestDb;
beforeAll(async () => { t = await create_test_db(); });
afterAll(async () => { await t.drop(); });

const TABLES = ["issue", "lesson", "lesson_version", "judge_verdict"];
const counts = async (): Promise<Record<string, string>> =>
  t.db.with_tx(async (tx) => {
    const out: Record<string, string> = {};
    for (const name of TABLES) {
      const r = await tx.query<{ n: string; s: string }>(`SELECT count(*)::text AS n, coalesce(md5(string_agg(x::text, '|' ORDER BY x::text)), '') AS s FROM ${name} x`);
      out[name] = `${r.rows[0]?.n}:${r.rows[0]?.s}`;
    }
    return out;
  });

describe("WF-31", () => {
  it("product_state_untouched", async () => {
    const before = await counts();
    const h = harness({ judge: scripted_judge(FLIP_4) });
    const repos = h.deps.repos;
    const evidence = new PgEvidenceRepo({ db: t.db, ids: new PrefixedIdGenerator(), clock: new FakeClock() });
    h.deps.repos = async (real) => ({ ...(await repos(real)), evidence });
    expect(await run_judge_calibrate([], h.deps)).toBe(0);
    expect(await counts()).toEqual(before);
    const rows = await t.db.with_tx(async (tx) => (await tx.query<{ n: string }>("SELECT count(*)::text AS n FROM eval_case_result c JOIN eval_run r ON r.id = c.eval_run_id WHERE r.suite = 'S12'")).rows);
    expect(rows[0]?.n).toBe("30");
  });
});
