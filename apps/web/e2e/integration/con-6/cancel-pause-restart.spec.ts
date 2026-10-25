// NL-96 AC-6 (WF-6): cancel after confirm, three same-check failures pause and Resume continues, a killed worker restarts cleanly.
import { expect, test } from "@playwright/test";
import { db } from "../support/db";
import { FLEX, L4, L5, getProgress, progressUrl, runState, startRun, waitRun, waitSql, settleAll } from "./helpers";
import { startWorker } from "./worker-harness";

test.afterEach(async ({ page }) => settleAll(page));

test("cancel-pause-restart (a): cancel after confirm lets in-flight calls finish, starts none, never-started tile fails as cancelled", async ({ page }) => {
  test.setTimeout(240_000);
  const run = await startRun(page);
  const worker = await startWorker({ script: "script-a", holds: [[L4, 1], [L5, 1]] });
  await page.goto(progressUrl(run));
  await waitSql(async () => worker.calls().filter((c) => c.lesson === L4 || c.lesson === L5).length, (n) => n === 2, 60_000);
  const atClick = worker.calls().length;
  await page.getByRole("button", { name: "Cancel run" }).click();
  await expect(page.getByRole("group", { name: "Confirm cancel" })).toBeVisible();
  await page.getByRole("group", { name: "Confirm cancel" }).getByRole("button", { name: "Cancel run" }).click();
  await waitRun(run.run_id, ["cancelled"]);
  worker.release(L4, 1);
  worker.release(L5, 1);
  await waitSql(() => db().query<{ status: string }>("select status from model_call where run_id=$1 and purpose='lesson_draft'", [run.run_id]), (r) => r.length === 2 && r.every((x) => x.status === "completed"), 30_000);
  await page.waitForTimeout(3000); // any new call would have been made by now
  console.log("AC-6a calls at click:", atClick, "calls after release+3s:", worker.calls().length);
  expect(worker.calls().length).toBe(atClick);
  const prog = await getProgress(page, run.run_id);
  const never = prog.tiles.find((t) => t.lesson_id === FLEX)!;
  expect(never.tile_state).toBe("failed");
  expect(never.failure_reasons[0]!.check).toBe("cancelled");
  // RunService.start creates the `lesson` shell (state draft) for every lesson in scope (ensure_lessons), so a lesson ROW exists;
  // the ticket's "no lesson row" means no content: no version, no doc, no current_version_id.
  expect(await db().query("select id from lesson where id=$1 and current_version_id is not null", [FLEX])).toEqual([]);
  expect(await db().count("lesson_doc", "lesson_id=$1", [FLEX])).toBe(0);
  expect(await db().count("lesson_version", "lesson_id=$1", [FLEX])).toBe(0);
  expect(await runState(run.run_id)).toBe("cancelled");
  await expect(page.getByText("Run cancelled. Calls in flight finished and were stored.")).toBeVisible({ timeout: 10_000 });
});

test("cancel-pause-restart (b): three lessons failing the same check pause the run; Resume continues it", async ({ page }) => {
  test.setTimeout(240_000);
  const run = await startRun(page, [8, 10, 11, 12, 13]); // five Reading lessons: L4, L6, L7, L8, L9
  const worker = await startWorker({ script: "same-check", env: { GENERATION_CONCURRENCY: "1" } });
  await waitRun(run.run_id, ["paused"], 60_000);
  const p = await getProgress(page, run.run_id);
  console.log("AC-6b paused_reason:", JSON.stringify(p.paused_reason), "| failing kinds:", JSON.stringify(await db().query("select lesson_id, status, failure_reasons_json from lesson_job where run_id=$1 and kind='lesson' order by finished_at", [run.run_id])));
  const failed = await db().query<{ kind: string }>("select failure_reasons_json->0->>'check_kind' kind from lesson_job where run_id=$1 and kind='lesson' and status='generation_failed'", [run.run_id]);
  expect(failed.length).toBeGreaterThanOrEqual(3);
  expect(new Set(failed.slice(0, 3).map((f) => f.kind)).size).toBe(1); // the same check failed three times in a row
  expect(p.paused_reason!.check).toBe(failed[0]!.kind);
  await page.goto(progressUrl(run));
  await expect(page.getByText(/Run paused: \d+ lessons in a row failed the same check/)).toBeVisible();
  worker.fix(); // the scripted fault is gone: drafts are WP-1's good draft from now on
  await page.waitForTimeout(1500); // anything already in flight at the pause has finished
  const callsAtPause = worker.calls().length;
  const queuedAtPause = await db().count("lesson_job", "run_id=$1 and kind='lesson' and status='queued'", [run.run_id]);
  await page.getByRole("button", { name: "Resume" }).click();
  await waitRun(run.run_id, ["running", "partial", "complete"]);
  const final = await waitRun(run.run_id, ["partial", "complete"]);
  console.log("AC-6b final state after Resume:", final, JSON.stringify((await getProgress(page, run.run_id)).tiles.map((t) => [t.lesson_key, t.tile_state])));
  console.log(`AC-6b queued at pause: ${queuedAtPause}; model calls at pause ${callsAtPause}, after Resume ${worker.calls().length}`);
  expect(queuedAtPause).toBeGreaterThanOrEqual(1);
  expect(worker.calls().length, "Resume made the worker pick the queued lesson up").toBeGreaterThan(callsAtPause);
});

test("cancel-pause-restart (c): a worker killed mid-call and restarted resumes, one call lost, no duplicate lesson_version", async ({ page }) => {
  test.setTimeout(240_000);
  const run = await startRun(page, [8, 9]);
  const first = await startWorker({ script: "script-a", holds: [[L4, 1]], env: { JOB_LEASE_MS: "1500", GENERATION_CONCURRENCY: "1" } });
  await waitSql(async () => first.calls().filter((c) => c.lesson === L4).length, (n) => n === 1, 60_000);
  await first.kill(); // SIGKILL mid-call
  await page.waitForTimeout(2500); // the 1500 ms lease lapses
  await startWorker({ script: "script-a", env: { JOB_LEASE_MS: "1500", GENERATION_CONCURRENCY: "1" } });
  await page.goto(progressUrl(run));
  await expect(page.getByText("The run resumed after a restart. 1 call lost in flight.")).toBeVisible({ timeout: 60_000 });
  await waitRun(run.run_id, ["complete", "partial"], 120_000);
  const dup = await db().query<{ lesson_id: string; n: number }>("select lesson_id, count(*)::int n from lesson_version where run_id=$1 group by 1 having count(*) > 1", [run.run_id]);
  expect(dup).toEqual([]);
  const lost = await db().query<{ purpose: string; status: string }>("select purpose, status from model_call where run_id=$1 and status='lost'", [run.run_id]);
  console.log("AC-6c lost calls:", JSON.stringify(lost), "versions:", JSON.stringify(await db().query("select lesson_id, number from lesson_version where run_id=$1", [run.run_id])));
  expect(lost).toHaveLength(1);
});

test("cancel-pause-restart (b2): the paused banner counts the lessons that failed the same check", async ({ page }) => {
  test.setTimeout(240_000);
  const run = await startRun(page, [8, 10, 11, 12, 13]);
  await startWorker({ script: "same-check", env: { GENERATION_CONCURRENCY: "1" } });
  await waitRun(run.run_id, ["paused"], 60_000);
  const p = await getProgress(page, run.run_id);
  expect(p.paused_reason!.lesson_ids.length).toBeGreaterThanOrEqual(3);
  await page.goto(progressUrl(run));
  const banner = page.getByText(/Run paused: \d+ lessons in a row failed the same check/);
  await expect(banner).toBeVisible();
  expect(Number((await banner.textContent())!.match(/paused: (\d+)/)![1])).toBe(p.paused_reason!.lesson_ids.length);
});
