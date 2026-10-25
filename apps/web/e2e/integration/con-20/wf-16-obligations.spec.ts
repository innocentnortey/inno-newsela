// NL-99 AC-12: obligations that ride on WF-16 (R-54, GR-9, GR-13, GR-16, OBS-11), against the real stack.
import { expect, test } from "@playwright/test";
import { db } from "../support/db";
import { getStack } from "../support/real-stack";
import { createUser, signInAs } from "../support/users";
import { submittedLesson } from "./flow";
import { checkRegistered, checkRestrictedFolderRule } from "./obligations";
import { ensureSeeded, freshUnit, seedLesson } from "./seed";
import { lessonUrl } from "./tabs";
import { DISCLOSURE_TEXT } from "./text";

const hb = () => ({ tab_id: "tab-oblig001", focused: true, visible: true, last_input_at: new Date().toISOString(), sent_at: new Date().toISOString(), version_id: "lv-1" });

test("R-54: allow-list sign-in and roles enforced on the heartbeat route", async ({ playwright, page }) => {
  await ensureSeeded();
  const unit = await freshUnit();
  const lesson = await seedLesson({ unit, number: 1, state: "in_review" });
  const bare = await playwright.request.newContext({ baseURL: getStack().baseURL });
  const anon = await bare.post(`/api/lessons/${lesson.lesson_id}/heartbeats`, { data: hb(), headers: { Origin: getStack().baseURL } });
  expect(anon.status()).toBe(401);
  await bare.dispose();
  const author = await createUser("author", { synthetic: false });
  await signInAs(page, author);
  const r = await page.request.post(`/api/lessons/${lesson.lesson_id}/heartbeats`, { data: hb(), headers: { Origin: getStack().baseURL } });
  expect(r.status()).toBe(403);
  const off = await playwright.request.newContext({ baseURL: getStack().baseURL });
  const bad = await off.post("/api/session", { data: { email: "not-on-the-list@example.test", password: "Not-A-Real-Pass-1" }, headers: { Origin: getStack().baseURL } });
  expect(bad.status()).toBeGreaterThanOrEqual(400);
  await off.dispose();
});

test("GR-9: the restricted source folder is ignored, untracked and never referenced by this folder's specs", async () => {
  checkRestrictedFolderRule();
});

test("GR-13: staff roles only; heartbeat rows hold ids and times, no student or teacher field", async () => {
  const roles = await db().query<{ role: string }>("select distinct role from app_user");
  for (const r of roles) expect(["author", "reviewer", "approver"]).toContain(r.role);
  const cols = await db().query<{ column_name: string }>("select column_name from information_schema.columns where table_name in ('heartbeat','review_session','lesson_metrics')");
  expect(cols.map((c) => c.column_name).filter((c) => /student|teacher_of|class|school/i.test(c))).toEqual([]);
});

test("GR-16: SCR-9 and SCR-14 frame the tool as expert-driven, never as replacing writers", async ({ page }) => {
  const s = await submittedLesson();
  await signInAs(page, s.reviewer);
  for (const approve of [false, true]) {
    await page.goto(lessonUrl(s.lesson.unit_key, s.lesson.lesson_key, approve));
    await expect(page.getByText(DISCLOSURE_TEXT)).toBeVisible({ timeout: 30_000 });
    const text = await page.locator("body").innerText();
    expect(text).not.toMatch(/replaces? (the )?(writers?|teachers?|editors?|humans?|experts?)|AI[- ]written|fully automated/i);
  }
});

test("OBS-11: WF-16 is registered and its capture test file exists", async () => {
  checkRegistered("WF-16", "test_heartbeat_capture", "heartbeat-capture.spec.ts");
});
