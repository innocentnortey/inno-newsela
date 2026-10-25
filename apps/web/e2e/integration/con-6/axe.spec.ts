// NL-96 AC-11: axe on every SCR-6 / SCR-7 state reached with real data, 1280x900 and 390x844, light and dark. 0 serious, 0 critical.
import { expect, test, type Page } from "@playwright/test";
import { axeScan, matrix, setTheme } from "../support/axe";
import { FLEX, L4, L5, control, createStaff, planUrl, progressUrl, runState, signInStaff, startRun, waitRun, waitSql, type StartedRun, settleAll } from "./helpers";
import { startWorker } from "./worker-harness";

test.afterEach(async ({ page }) => settleAll(page));

async function scan(page: Page, state: string): Promise<void> {
  await matrix(page, async ({ theme, viewport }) => {
    await setTheme(page, theme);
    const r = await axeScan(page);
    console.log(`axe ${state} ${viewport.width} ${theme}: serious=${r.serious} critical=${r.critical}`);
    expect(r.violations, `${state} ${viewport.width} ${theme}`).toEqual([]);
    expect(r.serious).toBe(0);
    expect(r.critical).toBe(0);
  });
}
const open = async (page: Page, run: StartedRun, plan = false) => {
  await page.goto(plan ? planUrl(run) : progressUrl(run));
  await page.waitForLoadState("networkidle");
};

test("axe loading (SCR-6) @axe", async ({ page }) => {
  const run = await startRun(page, [8, 9]);
  await page.route("**/api/runs/*/progress", async (r) => { await new Promise((ok) => setTimeout(ok, 4000)); await r.continue(); });
  await page.goto(progressUrl(run));
  await expect(page.getByText("Loading run progress")).toBeAttached();
  await scan(page, "scr6-loading");
});

test("axe running + stale + role view (SCR-6) @axe", async ({ page, browser, baseURL }) => {
  test.setTimeout(300_000);
  const run = await startRun(page, [8, 9]);
  const worker = await startWorker({ script: "script-a", holds: [[L4, 1]] });
  await waitSql(async () => worker.calls().filter((c) => c.lesson === L4).length, (n) => n === 1, 60_000);
  await open(page, run);
  await expect(page.getByRole("button", { name: "Cancel run" })).toBeVisible();
  await scan(page, "scr6-running");
  const ctx = await browser.newContext({ baseURL });
  const rp = await ctx.newPage();
  await signInStaff(rp, "reviewer");
  await open(rp, run);
  await expect(rp.getByText("Only authors can control a run")).toBeVisible();
  await scan(rp, "scr6-role-view");
  await ctx.close();
  await page.route("**/api/runs/*/progress", (r) => r.abort());
  await page.waitForTimeout(11_000); // more than 10 s without a successful poll
  await expect(page.getByText(/out of date|as of|last updated/i).first()).toBeVisible({ timeout: 15_000 });
  await scan(page, "scr6-stale");
  await page.unroute("**/api/runs/*/progress");
  worker.release(L4, 1);
});

test("axe cancelled (SCR-6) @axe", async ({ page }) => {
  test.setTimeout(240_000);
  const run = await startRun(page, [8, 9]);
  const worker = await startWorker({ script: "script-a", holds: [[L4, 1], [L5, 1]] });
  await waitSql(async () => worker.calls().length, (n) => n >= 3, 60_000);
  expect((await control(page, run.run_id, "cancel")).status()).toBe(200);
  worker.release(L4, 1);
  worker.release(L5, 1);
  await waitRun(run.run_id, ["cancelled"]);
  await open(page, run);
  await expect(page.getByText(/Run cancelled/)).toBeVisible();
  await scan(page, "scr6-cancelled");
});

test("axe complete (SCR-6) and plan stored (SCR-7) @axe", async ({ page }) => {
  test.setTimeout(240_000);
  const run = await startRun(page, [8, 9]);
  await startWorker({ script: "script-a" });
  await waitRun(run.run_id, ["complete"]);
  await open(page, run);
  await expect(page.getByText(/Run complete/)).toBeVisible();
  await scan(page, "scr6-complete");
  await open(page, run, true);
  await expect(page.getByRole("list", { name: "Teaching days" }).getByRole("listitem")).toHaveCount(2);
  await scan(page, "scr7-stored");
});

test("axe partial with a failed tile (SCR-6) @axe", async ({ page }) => {
  test.setTimeout(240_000);
  const run = await startRun(page);
  await startWorker({ script: "script-a" });
  await waitRun(run.run_id, ["partial"]);
  await open(page, run);
  await expect(page.getByText(/^Failed after 1 repair/)).toBeVisible();
  await scan(page, "scr6-partial-failed-tile");
});

test("axe paused (SCR-6) and capped (SCR-6) @axe", async ({ page }) => {
  test.setTimeout(300_000);
  const paused = await startRun(page, [8, 10, 11, 12, 13]);
  await startWorker({ script: "same-check", env: { GENERATION_CONCURRENCY: "1" } });
  await waitRun(paused.run_id, ["paused"]);
  await open(page, paused);
  await expect(page.getByText(/Run paused:/)).toBeVisible();
  await scan(page, "scr6-paused");
  await settleAll(page);
  const capped = await startRun(page, [8, 9, 25], 0.5);
  await startWorker({ script: "script-a" });
  await waitRun(capped.run_id, ["capped"]);
  await open(page, capped);
  await expect(page.getByText(/Run capped:/)).toBeVisible();
  await scan(page, "scr6-capped");
});

test("axe plan planning and plan failed (SCR-7) @axe", async ({ page }) => {
  test.setTimeout(300_000);
  const planning = await startRun(page, [8, 9]);
  const w = await startWorker({ script: "script-a", holds: [["plan"]] });
  await waitSql(async () => w.calls().length, (n) => n >= 1, 60_000);
  await open(page, planning, true);
  await expect(page.getByText(/The plan is being written/)).toBeVisible();
  await scan(page, "scr7-planning");
  await settleAll(page);
  const failed = await startRun(page, [8, 9]);
  await startWorker({ script: "plan-fails-twice" });
  await waitSql(() => runState(failed.run_id), (s) => s === "paused", 60_000);
  await open(page, failed, true);
  await expect(page.getByText(/The plan couldn't be written/)).toBeVisible();
  await scan(page, "scr7-failed");
  void FLEX; void createStaff;
});
