// NL-96 AC-7 (WF-6): INVALID_TRANSITION with details.state, nothing changed; the screen says so and re-reads; two Cancels give one winner.
import { expect, test, type Page } from "@playwright/test";
import { db } from "../support/db";
import { auditCount, control, COPY, FLEX, L4, progressUrl, runState, signInStaff, startRun, waitRun, waitSql, settleAll } from "./helpers";
import { startWorker } from "./worker-harness";

test.afterEach(async ({ page }) => settleAll(page));

async function expectRefused(page: Page, runId: string, action: "resume" | "retry_failed", state: string) {
  const mine = async () => ({
    run: await db().query("select x::text t from run x where id=$1", [runId]),
    jobs: await db().query("select x::text t from lesson_job x where run_id=$1 order by id", [runId]),
  });
  const runs0 = await mine();
  const audit0 = await auditCount();
  const res = await control(page, runId, action);
  const body = (await res.json()) as { error: { code: string; details: { state: string } } };
  expect(res.status(), JSON.stringify(body)).toBe(409);
  expect(body.error.code).toBe("INVALID_TRANSITION");
  expect(body.error.details.state).toBe(state);
  expect(await mine()).toEqual(runs0);
  expect(await auditCount()).toBe(audit0);
}

test("invalid-transition: Resume on a running run and Retry failed on a complete run are refused and change nothing", async ({ page }) => {
  test.setTimeout(240_000);
  const run = await startRun(page, [8, 9]);
  const worker = await startWorker({ script: "script-a", holds: [[L4, 1]] });
  await waitSql(async () => worker.calls().filter((c) => c.lesson === L4).length, (n) => n === 1, 60_000);
  expect(await runState(run.run_id)).toBe("running");
  await expectRefused(page, run.run_id, "resume", "running");
  worker.release(L4, 1);
  await waitRun(run.run_id, ["complete"]);
  await expectRefused(page, run.run_id, "retry_failed", "complete");
});

test("invalid-transition: a stale Retry failed click shows the failure line and re-reads progress", async ({ page }) => {
  test.setTimeout(240_000);
  const run = await startRun(page);
  const worker = await startWorker({ script: "script-a" });
  await waitRun(run.run_id, ["partial"]);
  await page.goto(progressUrl(run));
  const retry = page.getByRole("button", { name: "Retry failed" });
  await expect(retry).toBeVisible();
  // Freeze the screen on "partial" while another author retries; the retried job is held so the run stays running.
  await page.route("**/api/runs/*/progress", (r) => r.abort());
  worker.hold(FLEX);
  const other = await page.context().browser()!.newContext({ baseURL: page.url().split("/units")[0] });
  const otherPage = await other.newPage();
  await signInStaff(otherPage, "author");
  expect((await control(otherPage, run.run_id, "retry_failed")).status()).toBe(200);
  await other.close();
  await expect(retry).toBeVisible();
  await page.unroute("**/api/runs/*/progress");
  const audit0 = await auditCount();
  const reread = page.waitForResponse((r) => /\/progress$/.test(r.url()));
  await retry.click();
  await expect(page.getByText(COPY.controlErrorText("retry_failed"))).toBeVisible();
  await reread; // the screen re-reads progress after the refusal
  expect(await auditCount()).toBe(audit0);
  worker.release(FLEX);
});

test("invalid-transition: two authors cancelling at once give one cancel and one INVALID_TRANSITION", async ({ page, browser, baseURL }) => {
  test.setTimeout(240_000);
  const run = await startRun(page, [8, 9]);
  const worker = await startWorker({ script: "script-a", holds: [[L4, 1]] });
  await waitSql(async () => worker.calls().length, (n) => n >= 2, 60_000);
  const second = await browser.newContext({ baseURL });
  const p2 = await second.newPage();
  await signInStaff(p2, "author");
  const a0 = await db().count("audit_event", "target_id=$1 and action='run.cancel'", [run.run_id]);
  const [r1, r2] = await Promise.all([control(page, run.run_id, "cancel"), control(p2, run.run_id, "cancel")]);
  const statuses = [r1.status(), r2.status()].sort();
  console.log("AC-7 concurrent cancel statuses:", statuses.join(","));
  expect(statuses).toEqual([200, 409]);
  const loser = (r1.status() === 409 ? r1 : r2);
  expect(((await loser.json()) as { error: { code: string } }).error.code).toBe("INVALID_TRANSITION");
  expect(await db().count("audit_event", "target_id=$1 and action='run.cancel'", [run.run_id])).toBe(a0 + 1);
  expect(await runState(run.run_id)).toBe("cancelled");
  await second.close();
  worker.release(L4, 1);
});
