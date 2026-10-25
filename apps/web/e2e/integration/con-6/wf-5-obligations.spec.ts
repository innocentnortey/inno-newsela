// NL-96 AC-15: obligations that ride on WF-5 (run progress reads). One case per id, against the real stack with a finished stub run.
import { test } from "@playwright/test";
import { signInAs } from "../support/users";
import { bannedIn } from "../support/copy-rules";
import { expect } from "@playwright/test";
import { conG8, gr13, gr9, obs11, obs7, r54 } from "./obligations";
import { progressUrl, sharedRun } from "./helpers";
import { killAllWorkers, startWorker } from "./worker-harness";

test.afterAll(killAllWorkers);
const run = (browser: Parameters<typeof sharedRun>[0], baseURL: string | undefined) => sharedRun(browser, baseURL!, "script-a");

test("R-54: no cookie is UNAUTHENTICATED on the reads; a reviewer's control call is ROLE_FORBIDDEN", async ({ page, browser, baseURL, playwright }) => {
  await r54(page, await run(browser, baseURL), playwright, baseURL!);
});
test("GR-9: the restricted folder is git-ignored, untracked and not named by any con-6 spec", async () => { gr9(); });
test("GR-13: staff roles only; no student or teacher keys in the progress and plan responses", async ({ page, browser, baseURL }) => {
  const r = await run(browser, baseURL);
  await signInAs(page, r.user);
  await gr13(page, r);
});
test("CON-G1: the role is decided on the server for every control action", async ({ page, browser, baseURL, playwright }) => {
  await r54(page, await run(browser, baseURL), playwright, baseURL!);
});
test("CON-G8: no minutes or review-time key, so no name can sit beside one", async ({ page, browser, baseURL }) => {
  const r = await run(browser, baseURL);
  await signInAs(page, r.user);
  await conG8(page, r);
});
test("OBS-7: no cookie value, password, provider key or restricted path in logs, worker lines or tables", async ({ page, browser, baseURL }) => {
  const r = await run(browser, baseURL);
  await signInAs(page, r.user);
  await page.goto(progressUrl(r));
  await page.waitForTimeout(500);
  await obs7(page, r.user, []);
});
test("OBS-11: the WF-5 row is registered and names test_progress_reflects_jobs", async () => { obs11("WF-5", "test_progress_reflects_jobs", "progress.spec.ts"); });
test("GR-16 (screen copy of WF-5): no replace-writers phrasing on SCR-6", async ({ page, browser, baseURL }) => {
  const r = await run(browser, baseURL);
  await signInAs(page, r.user);
  await page.goto(progressUrl(r));
  expect(bannedIn(await page.locator("body").innerText())).toEqual([]);
});
void startWorker;
