// NL-96 AC-8 (WF-6): reviewers and approvers cannot control a run; a run at its cap ends capped with no raise-the-cap control.
import { expect, test } from "@playwright/test";
import { db } from "../support/db";
import { auditCount, control, getProgress, L4, progressUrl, signInStaff, startRun, waitRun, waitSql, settleAll } from "./helpers";
import { startWorker } from "./worker-harness";

test.afterEach(async ({ page }) => settleAll(page));

for (const role of ["reviewer", "approver"] as const) {
  test(`roles-and-capped: a ${role} sees "Only authors can control a run", no control, and a direct call is ROLE_FORBIDDEN`, async ({ page, browser, baseURL }) => {
    test.setTimeout(240_000);
    const run = await startRun(page, [8, 9]);
    const worker = await startWorker({ script: "script-a", holds: [[L4, 1]] }); // the run stays running, so an author WOULD see Cancel
    await waitSql(async () => worker.calls().filter((c) => c.lesson === L4).length, (n) => n === 1, 60_000);
    const ctx = await browser.newContext({ baseURL });
    const p = await ctx.newPage();
    await signInStaff(p, role);
    await p.goto(progressUrl(run));
    await expect(p.getByText("Only authors can control a run")).toBeVisible();
    for (const name of ["Cancel run", "Resume", "Retry failed"]) expect(await p.getByRole("button", { name }).count()).toBe(0);
    const audit0 = await auditCount();
    for (const action of ["cancel", "resume", "retry_failed"] as const) {
      const res = await control(p, run.run_id, action);
      expect(res.status()).toBe(403);
      expect(((await res.json()) as { error: { code: string } }).error.code).toBe("ROLE_FORBIDDEN");
    }
    expect(await auditCount()).toBe(audit0);
    console.log(`AC-8 ${role}: control buttons 0, 3 refusals ROLE_FORBIDDEN, audit rows unchanged at ${audit0}`);
    await ctx.close();
    worker.release(L4, 1);
  });
}

test("roles-and-capped: a run that reaches its cap ends capped; the banner links to SCR-5 with the unfinished rows; no raise-the-cap control", async ({ page }) => {
  test.setTimeout(240_000);
  const run = await startRun(page, [8, 9, 25], 0.5);
  await startWorker({ script: "script-a", env: { GENERATION_CONCURRENCY: "2" } });
  await waitRun(run.run_id, ["capped"]);
  const prog = await getProgress(page, run.run_id);
  console.log("AC-8 capped:", JSON.stringify({ state: prog.state, capped_by: prog.capped_by, spent: prog.spent_usd, reserved: prog.reserved_usd, cap: prog.cap_usd }));
  expect(prog.capped_by).toBe("run_cap");
  expect(prog.spent_usd + prog.reserved_usd).toBeLessThanOrEqual(prog.cap_usd);
  await page.goto(progressUrl(run));
  await expect(page.getByText(/Run capped: the next call would pass the \$0\.50 cap/)).toBeVisible();
  const link = page.getByRole("link", { name: "Start a new run on the unfinished rows" });
  await expect(link).toHaveAttribute("href", new RegExp(`/units/${run.unitKey}/board\\?start_run=unfinished_of_run&run_id=${run.run_id}`));
  const text = await page.locator("body").innerText();
  expect(text).not.toMatch(/raise.*cap/i);
  expect(await page.getByRole("button", { name: /raise|increase|more budget/i }).count()).toBe(0);
  await link.click();
  await expect(page).toHaveURL(/start_run=unfinished_of_run/);
  expect(await db().count("run", "id=$1 and state='capped'", [run.run_id])).toBe(1);
});
