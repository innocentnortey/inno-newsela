// NL-96 AC-12: SCR-6 and SCR-7, main and one error state, 1280x900 and 390x844, light and dark, on real data. Explicit screenshots
// (the real config's snapshotPathTemplate is hard-wired to con-1, so toHaveScreenshot is not used).
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { matrix, setTheme } from "../support/axe";
import { planUrl, progressUrl, runState, startRun, waitRun, waitSql, type StartedRun, settleAll } from "./helpers";
import { startWorker } from "./worker-harness";

test.afterEach(async ({ page }) => settleAll(page));
const DIR = resolve(__dirname, "../../__screenshots__/integration/con-6");

async function shoot(page: Page, name: string): Promise<void> {
  mkdirSync(DIR, { recursive: true });
  await matrix(page, async ({ theme, viewport }) => {
    await setTheme(page, theme);
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: resolve(DIR, `${name}-${viewport.width}-${theme}.png`), fullPage: true });
  });
}
const go = async (page: Page, run: StartedRun, plan: boolean) => { await page.goto(plan ? planUrl(run) : progressUrl(run)); await page.waitForLoadState("networkidle"); };

test("scr6 main (partial run with a failed tile) @visual", async ({ page }) => {
  test.setTimeout(240_000);
  const run = await startRun(page);
  await startWorker({ script: "script-a" });
  await waitRun(run.run_id, ["partial"]);
  await go(page, run, false);
  await expect(page.getByText(/^Failed after 1 repair/)).toBeVisible();
  await shoot(page, "scr6-main-partial");
  await go(page, run, true);
  await expect(page.getByRole("list", { name: "Teaching days" }).getByRole("listitem")).toHaveCount(3);
  await shoot(page, "scr7-main-stored");
});

test("scr6 error (paused) and scr7 error (plan failed) @visual", async ({ page }) => {
  test.setTimeout(300_000);
  const paused = await startRun(page, [8, 10, 11, 12, 13]);
  await startWorker({ script: "same-check", env: { GENERATION_CONCURRENCY: "1" } });
  await waitRun(paused.run_id, ["paused"]);
  await go(page, paused, false);
  await expect(page.getByText(/Run paused:/)).toBeVisible();
  await shoot(page, "scr6-error-paused");
  await settleAll(page);
  const failed = await startRun(page, [8, 9]);
  await startWorker({ script: "plan-fails-twice" });
  await waitSql(() => runState(failed.run_id), (s) => s === "paused", 60_000);
  await go(page, failed, true);
  await expect(page.getByText(/The plan couldn't be written/)).toBeVisible();
  await shoot(page, "scr7-error-plan-failed");
});
