// NL-96 AC-4 (WF-21): the plan call fails until its retries are spent; the run pauses; Resume on SCR-6 retries the plan and the run completes.
import { expect, test } from "@playwright/test";
import { db } from "../support/db";
import { COPY, getProgress, planUrl, progressUrl, runState, startRun, waitRun, waitSql, settleAll } from "./helpers";
import { startWorker } from "./worker-harness";

test.afterEach(async ({ page }) => settleAll(page));

test("plan-failed-resume: paused on unit_plan, SCR-7 failed state, Resume, paused -> running -> complete", async ({ page }) => {
  test.setTimeout(240_000);
  const run = await startRun(page, [8, 9]);
  const worker = await startWorker({ script: "plan-fails-twice" });
  const seen: string[] = [];
  const track = async () => { const s = await runState(run.run_id); if (seen[seen.length - 1] !== s) seen.push(s); return s; };

  await waitSql(track, (s) => s === "paused", 60_000, 100);
  const p1 = await getProgress(page, run.run_id);
  expect(p1.paused_reason?.check).toBe("unit_plan");
  await page.goto(planUrl(run));
  await expect(page.getByText(COPY.FAILED_TEXT)).toBeVisible();
  await page.getByRole("link", { name: "Open the run" }).click();
  await expect(page).toHaveURL(new RegExp(`${progressUrl(run)}$`));

  const failedCalls = worker.calls().filter((c) => c.lesson === "plan").length;
  console.log("AC-4 plan calls before the pause (1 + retries):", failedCalls);
  expect(failedCalls).toBe(4);
  await page.getByRole("button", { name: "Resume" }).click();
  await waitSql(track, (s) => s !== "paused", 15_000, 25);
  await waitSql(() => db().query<{ state: string }>("select state from unit_plan where run_id=$1", [run.run_id]), (r) => r[0]?.state === "stored", 60_000);
  console.log("AC-4 run states observed:", seen.join(" -> "), "| calls to the plan:", worker.calls().filter((c) => c.lesson === "plan").length);
  expect(seen).toContain("paused");
  expect(seen).toContain("running");
  const [r] = await db().query<{ plan_stored_at: string | null; state: string }>("select plan_stored_at::text, state from run where id=$1", [run.run_id]);
  console.log("AC-4 after Resume: run.state =", r!.state, "run.plan_stored_at =", r!.plan_stored_at);
  expect(r!.plan_stored_at, "store_unit_plan stamps plan_stored_at even though Resume already set state = running").not.toBeNull();
});

test("plan-failed-resume: the resumed run goes on to complete", async ({ page }) => {
  test.setTimeout(240_000);
  const run = await startRun(page, [8, 9]);
  await startWorker({ script: "plan-fails-twice" });
  await waitRun(run.run_id, ["paused"], 60_000);
  await page.goto(progressUrl(run));
  await page.getByRole("button", { name: "Resume" }).click();
  const final = await waitRun(run.run_id, ["complete", "partial"], 90_000);
  console.log("AC-4 final state after Resume:", final);
  const jobs = await db().query<{ status: string }>("select status from lesson_job where run_id=$1 and kind='lesson'", [run.run_id]);
  expect(jobs.length).toBeGreaterThan(0);
  expect(jobs.every((j) => j.status !== "queued")).toBe(true);
});
