// NL-99 AC-7 (WF-16/WF-44): the S8 scripted review is recorded as one eval_case_result row through PgEvidenceRepo.
import { expect, test } from "@playwright/test";
import { db } from "../support/db";
import { cachedResult, recordS8Row, runS8 } from "./runner";

test("s8-result-row: one S8 case result carries script minutes, stored minutes and pass/fail against 1 minute", async ({ browser }) => {
  test.setTimeout(480_000);
  const r = cachedResult() ?? (await runS8(browser));
  const { eval_run_id, within, sha } = await recordS8Row(r);
  expect(within).toBe(true);
  const rows = await db().query<{ case_id: string; passed: boolean; expected_json: Record<string, number>; actual_json: Record<string, number | boolean> }>(
    "select case_id, passed, expected_json, actual_json from eval_case_result where eval_run_id = $1",
    [eval_run_id],
  );
  expect(rows).toHaveLength(1);
  const row = rows[0]!;
  console.log(`S8 row ${eval_run_id}: expected ${JSON.stringify(row.expected_json)} actual ${JSON.stringify(row.actual_json)} passed ${row.passed}`);
  expect(row.case_id).toBe("s8-3-lesson-review");
  expect(Object.keys(row.expected_json)).toHaveLength(3);
  expect(row.actual_json["within_one_minute"]).toBe(true);
  expect(row.passed).toBe(true);
  const suite = await db().query<{ suite: string; git_sha: string }>("select suite, git_sha from eval_run where id = $1", [eval_run_id]);
  expect(suite[0]).toEqual({ suite: "S8", git_sha: sha });
});
