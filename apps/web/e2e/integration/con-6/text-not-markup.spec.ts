// NL-96 AC-9: model text on SCR-6 and SCR-7 is rendered as text, and the copy has no replace-writers phrasing.
import { expect, test } from "@playwright/test";
import { bannedIn } from "../support/copy-rules";
import { MARKUP } from "./fixtures/markup";
import { planUrl, progressUrl, startRun, waitRun, settleAll } from "./helpers";
import { startWorker } from "./worker-harness";

test.afterEach(async ({ page }) => settleAll(page));

test("text-not-markup: a plan entry with markup shows literally; no element, no handler; failure text is text; zero banned phrases", async ({ page }) => {
  test.setTimeout(240_000);
  const run = await startRun(page);
  await startWorker({ script: "markup-plan" });
  await waitRun(run.run_id, ["partial"]);
  await page.goto(planUrl(run));
  await expect(page.getByRole("list", { name: "Teaching days" }).getByRole("listitem")).toHaveCount(3);
  await expect(page.getByText(MARKUP, { exact: false })).toBeVisible();
  expect(await page.locator("main b[onmouseover]").count()).toBe(0);
  expect(await page.locator("[onmouseover]").count()).toBe(0);
  expect(await page.evaluate(() => (window as unknown as { __x?: number }).__x)).toBeUndefined();
  const planBody = await page.locator("body").innerText();
  expect(bannedIn(planBody)).toEqual([]);

  await page.goto(progressUrl(run));
  const failed = page.getByText(/^Failed after 1 repair: /);
  await expect(failed).toBeVisible();
  expect(await page.locator("main b[onmouseover]").count()).toBe(0);
  const progBody = await page.locator("body").innerText();
  expect(bannedIn(progBody)).toEqual([]);
  console.log("AC-9 markup elements: 0; window.__x undefined; banned phrases on SCR-6/SCR-7: 0/0; failure line:", await failed.innerText());
});
