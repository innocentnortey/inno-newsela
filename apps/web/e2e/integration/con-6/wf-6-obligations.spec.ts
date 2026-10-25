// NL-96 AC-16: obligations that ride on WF-6 (run control). One case per id, against the real stack.
import { expect, test } from "@playwright/test";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { bannedIn } from "../support/copy-rules";
import { db } from "../support/db";
import { signInAs } from "../support/users";
import { control, FLEX, L4, L5, progressUrl, runState, sharedRun, startRun, waitRun } from "./helpers";
import { conG8, gr13, gr9, obs11, obs7, r54, ROOT, WEB } from "./obligations";
import { killAllWorkers, startWorker } from "./worker-harness";

test.afterAll(killAllWorkers);
const run = (browser: Parameters<typeof sharedRun>[0], baseURL: string | undefined) => sharedRun(browser, baseURL!, "script-a");

test("R-54: a reviewer's Cancel/Resume/Retry is refused on the server and an anonymous caller is UNAUTHENTICATED", async ({ page, browser, baseURL, playwright }) => {
  await r54(page, await run(browser, baseURL), playwright, baseURL!);
});
test("GR-9: the restricted folder is git-ignored, untracked and not named by any con-6 spec", async () => { gr9(); });
test("GR-13: staff roles only; no student or teacher keys in the control responses", async ({ page, browser, baseURL }) => {
  const r = await run(browser, baseURL);
  await signInAs(page, r.user);
  await gr13(page, r);
});
test("GR-16: no replace-writers phrasing on the run screen's control copy", async ({ page, browser, baseURL }) => {
  const r = await run(browser, baseURL);
  await signInAs(page, r.user);
  await page.goto(progressUrl(r));
  await expect(page.getByRole("button", { name: "Retry failed" })).toBeVisible();
  expect(bannedIn(await page.locator("body").innerText())).toEqual([]);
});
test("CON-G8: the control responses carry no minutes or review-time key", async ({ page, browser, baseURL }) => {
  const r = await run(browser, baseURL);
  await signInAs(page, r.user);
  await conG8(page, r);
  const res = await control(page, r.run_id, "resume");
  expect(JSON.stringify(await res.json())).not.toMatch(/minutes|review_time/i);
});
test("EV-S6: the scripted S6-style facts hold: terminal lessons, no duplicate version, no call paid twice", async ({ page, browser, baseURL }) => {
  const r = await run(browser, baseURL);
  const tiles = await db().query<{ lesson_id: string; status: string }>("select lesson_id, status from lesson_job where run_id=$1 and kind='lesson'", [r.run_id]);
  expect(tiles.map((t) => t.lesson_id).sort()).toEqual([FLEX, L4, L5].sort());
  for (const t of tiles) expect(["ready", "generation_failed", "failed"], t.lesson_id).toContain(t.status);
  expect(await db().query("select lesson_id from lesson_version where run_id=$1 group by lesson_id having count(*) > 1", [r.run_id])).toEqual([]);
  // No re-paid call: at most one settled reservation per model call.
  expect(await db().query("select model_call_id from spend_reservation where run_id=$1 and status='settled' group by model_call_id having count(*) > 1", [r.run_id])).toEqual([]);
  // Retrying the failed lesson pays for no new call (its draft and repair are reused).
  await signInAs(page, r.user);
  const mc0 = await db().count("model_call", "run_id=$1", [r.run_id]);
  const res = await control(page, r.run_id, "retry_failed");
  expect(res.status()).toBe(200);
  await new Promise((ok) => setTimeout(ok, 4000));
  await waitRun(r.run_id, ["partial", "complete"]);
  expect(await db().count("model_call", "run_id=$1", [r.run_id])).toBe(mc0);
  console.log("EV-S6 facts: 3 terminal lessons, 0 duplicate versions, 0 re-paid calls, run state", await runState(r.run_id));
  void startRun;
  void startWorker;
});
test("OBS-1: the capture test for WF-6 exists and its rows carry the run id", async ({ page, browser, baseURL }) => {
  const r = await run(browser, baseURL);
  expect(existsSync(join(WEB, "e2e/integration/con-6/run-control.spec.ts"))).toBe(true);
  expect(readFileSync(join(WEB, "e2e/integration/con-6/run-control.spec.ts"), "utf8")).toContain("test_run_control_capture");
  expect(await db().count("audit_event", "target_id=$1 and action='run.start'", [r.run_id])).toBe(1);
  void page;
});
test("OBS-3: request_id on the audit rows and in a refused call's error body", async ({ page, browser, baseURL }) => {
  const r = await run(browser, baseURL);
  await signInAs(page, r.user);
  const res = await control(page, r.run_id, "resume");
  const body = (await res.json()) as { error: { details: { request_id?: string } } };
  console.log("OBS-3 refused-call body request_id:", body.error.details.request_id, "headers:", Object.keys(res.headers()).filter((h) => /request/i.test(h)).join(","));
  expect(body.error.details.request_id).toMatch(/^req_/);
  const audit = await db().query<{ request_id: string | null }>("select request_id from audit_event where target_id=$1", [r.run_id]);
  expect(audit.length).toBeGreaterThan(0);
  for (const a of audit) expect(a.request_id).toMatch(/^req_/);
});
test("OBS-7: no cookie value, password, provider key or restricted path in logs or tables", async ({ page, browser, baseURL }) => {
  const r = await run(browser, baseURL);
  await signInAs(page, r.user);
  await obs7(page, r.user, []);
});
test("OBS-11: the WF-6 row is registered and names test_run_control_capture", async () => { obs11("WF-6", "test_run_control_capture", "run-control.spec.ts"); });
void ROOT;
