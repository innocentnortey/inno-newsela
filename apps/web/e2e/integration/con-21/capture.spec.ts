// NL-97 AC-7: report_path is empty until the S9 report exists, then equals its path; the summary request log carries run_id and a duration.
import { expect, test } from "@playwright/test";
import { db } from "../support/db";
import { getStack } from "../support/real-stack";
import { getSummary, runScenario, summaryApi } from "./helpers";

test.setTimeout(240_000);

test("capture: report_path follows the S9 report and the summary read is logged with run_id and duration", async ({ page }) => {
  const { runId } = await runScenario(page, "repaired");
  expect((await getSummary(page, runId)).report_path).toBeNull();

  // summary_rows reads report_path from eval_run through run.eval_run_id. No writer on main links a finished run to its report
  // (the link is set at run insert), so the S9 row and the link are written the way the reader expects (devlog).
  const evalId = `eval_e2e_${runId.slice(-8)}`;
  const path = `docs/reports/${evalId}.md`;
  await db().query(
    "insert into eval_run (id, suite, git_sha, models_json, provider_mode, case_set, run_id, report_path, passed, total, finished_at) values ($1,'s9-full-run','e2e','{}','stub','full',$2,$3,1,1,now())",
    [evalId, runId, path],
  );
  await db().query("update run set eval_run_id=$1 where id=$2", [evalId, runId]);
  expect((await getSummary(page, runId)).report_path).toBe(path);

  const before = getStack().logs().length;
  const res = await page.request.get(summaryApi(runId));
  expect(res.status()).toBe(200);
  await expect.poll(() => getStack().logs().slice(before).filter((l) => l.includes(runId)).length, { timeout: 10_000 }).toBeGreaterThan(0);
  const line = getStack().logs().slice(before).filter((l) => l.includes(runId)).map((l) => JSON.parse(l) as Record<string, unknown>)[0]!;
  console.log("summary log line", JSON.stringify(line));
  expect(line["run_id"]).toBe(runId);
  expect(typeof line["duration_ms"]).toBe("number");
});
