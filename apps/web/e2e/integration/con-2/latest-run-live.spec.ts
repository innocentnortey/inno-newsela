// NL-93 AC-7 (Running and Complete half): SCR-2 shows the pill and counts of a real run driven by the stand-in worker. Imports con-6's harness read-only.
import { expect, test } from "@playwright/test";
import { db } from "../support/db";
import { L4, progressUrl, runState, settleAll, startRun, waitRun, waitSql } from "../con-6/helpers";
import { startWorker } from "../con-6/worker-harness";

test.afterEach(async ({ page }) => settleAll(page));

test("latest-run: SCR-2 shows Running then Complete with the real worker's counts, links to SCR-6, reads progress once", async ({
  page,
}) => {
  test.setTimeout(240_000);
  const run = await startRun(page, [8, 9]); // rows 8 and 9: script-a drafts both cleanly (row 25, the flex day, fails by design in con-6)

  // Before the worker exists: the pill is whatever label the DB state maps to; no hard-coded label.
  await page.goto("/units");
  await expect(page.getByRole("link", { name: "View run progress" })).toBeVisible();
  const pre = await runState(run.run_id);
  console.log(`latest-run: pre-worker run state ${pre}; card text: ${(await page.locator("main").innerText()).replace(/\s+/g, " ").slice(0, 200)}`);

  const worker = await startWorker({ script: "script-a", holds: [[L4, 1]] }); // L4 held: L5 becomes ready, so the card reads 1 of 2 ready while the run is Running
  const ready = () =>
    db().query<{ n: number }>("select count(*)::int n from lesson_job where run_id=$1 and kind='lesson' and tile_state='ready'", [run.run_id]).then((r) => r[0]!.n);
  await waitSql(ready, (n) => n >= 1, 60_000);
  await waitRun(run.run_id, ["running"], 60_000);
  const readyNow = await ready();
  const total = (await db().query<{ n: number }>("select count(*)::int n from lesson_job where run_id=$1 and kind='lesson'", [run.run_id]))[0]!.n;

  const urls: string[] = [];
  page.on("request", (r) => urls.push(new URL(r.url()).pathname));
  await page.goto("/units");
  await page.waitForLoadState("networkidle");
  const card = page.locator("main");
  await expect(card.getByText("Running", { exact: true }).first()).toBeVisible();
  await expect(card.getByText(`${readyNow} of ${total} ready`)).toBeVisible();
  const link = page.getByRole("link", { name: "View run progress" });
  await expect(link).toHaveAttribute("href", new RegExp(`${progressUrl(run).replace(/[.]/g, "\\.")}$`));
  await page.waitForLoadState("networkidle");
  // The page reads the list once; since GEN-5 the nav frame reads it once more to point "Unit board" at the latest unit. No polling beyond that.
  expect(urls.filter((u) => u === "/api/units").length).toBeLessThanOrEqual(2);
  expect(urls.filter((u) => /\/api\/runs\/.*\/progress/.test(u))).toHaveLength(1);

  worker.release(L4, 1);
  await waitRun(run.run_id, ["complete"], 120_000);
  await page.goto("/units");
  await expect(card.getByText("Complete", { exact: true }).first()).toBeVisible();
  await expect(card.getByText(`${total} of ${total} ready`)).toBeVisible();
  await page.getByRole("link", { name: "View run progress" }).click();
  await expect(page).toHaveURL(new RegExp(`${progressUrl(run).replace(/[.]/g, "\\.")}$`));
  await expect(page.getByText(`Run complete: ${total} of ${total} ready.`)).toBeVisible();

  const audits = await db().count("audit_event", "actor_id=$1", [run.user.user_id]);
  const lv = await db().count("lesson_version");
  for (let i = 0; i < 5; i++) {
    expect((await page.request.get("/api/units")).status()).toBe(200);
    expect((await page.request.get(`/api/runs/${run.run_id}/progress`)).status()).toBe(200);
  }
  expect(await db().count("audit_event", "actor_id=$1", [run.user.user_id])).toBe(audits);
  expect(await db().count("lesson_version")).toBe(lv);
});
