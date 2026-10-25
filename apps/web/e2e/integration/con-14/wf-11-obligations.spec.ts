/* eslint-disable @typescript-eslint/no-explicit-any -- parsed JSON response bodies from the real stack are untyped */
// NL-113 AC-17 (coverage): WF-11's PRD obligations, one case each, driving resolve / clear flag / confirm on the real stack.
import { expect, test } from "@playwright/test";
import { db } from "../support/db";
import { api, issuesOf, openLesson, stored, waitCheckedHash } from "../con-13/helpers";
import { endFlow, expertFraming, noNamedMinutes, printPassed, registered, restrictedFolderRule, staffOnly, startFlow, type Flow } from "../con-13/obligations";
import { stopLive } from "../con-13/stack";

test.describe.configure({ mode: "serial" });
let f: Flow | undefined;
const passed: string[] = [];
test.beforeAll(async ({ browser }) => {
  f = await startFlow(browser);
});
test.afterAll(async () => {
  await endFlow(f);
  await stopLive();
});
const done = (id: string) => passed.push(id);

test("R-26: a decision is one durable store written by the collaboration server (bytes, derived JSON, hash, state vector)", async () => {
  const before = await stored(f!.lesson.lessonId);
  const res = await api(f!.reviewer.page, "POST", `/lessons/${f!.lesson.lessonId}/standards/decision`, { code: "W.6.2", decision: "confirm" });
  expect(res.status).toBe(200);
  const row = (await db().query<any>("select seq, ydoc_bytes, derived_json, content_hash, state_vector, stored_by, request_id from lesson_doc where lesson_id = $1 order by seq desc limit 1", [f!.lesson.lessonId]))[0];
  expect(row.seq).toBe(before.seq + 1);
  expect(row.ydoc_bytes.length).toBeGreaterThan(0);
  expect(row.state_vector.length).toBeGreaterThan(0);
  expect(row.content_hash).toMatch(/^[0-9a-f]{64}$/);
  expect(row.derived_json.sections.length).toBeGreaterThan(0);
  expect(row.stored_by).toBe(f!.reviewer.user.user_id);
  done("R-26");
});

test("R-28: the check lane re-runs on that durable save and reads the stored row, within 5 s", async () => {
  const doc = await stored(f!.lesson.lessonId);
  const t0 = Date.now();
  await expect
    .poll(async () => {
      const l = (await issuesOf(f!.reviewer.page, f!.lesson.lessonId)).body;
      return l.checked_hash === doc.content_hash && !l.pending;
    }, { timeout: 5000, intervals: [100] })
    .toBe(true);
  console.log(`R-28: checked ${Date.now() - t0} ms after the save`);
  done("R-28");
});

test("GR-4: every alignment link says who asserted it; no bare standards-aligned badge", async () => {
  const links = await db().query<{ asserted_by: string; origin: string }>("select asserted_by, origin from alignment_link where lesson_id = $1", [f!.lesson.lessonId]);
  expect(links.length).toBeGreaterThan(0);
  expect(links.every((l) => l.asserted_by && l.asserted_by.length > 0)).toBe(true);
  await expertFraming(f!.reviewer.page, f!.lesson);
  done("GR-4");
});

test("GR-9: the restricted source folder is ignored, untracked and never referenced by this ticket's specs", async () => {
  restrictedFolderRule();
  done("GR-9");
});

test("GR-13: staff roles only; no student or teacher-of-record data", async () => {
  await staffOnly();
  done("GR-13");
});

test("GR-16: the Resolve dialog and the rail frame the tool as expert-driven", async () => {
  const page = f!.reviewer.page;
  await openLesson(page, f!.lesson);
  await waitCheckedHash(page, f!.lesson.lessonId);
  await page.getByRole("tab", { name: /Issues/ }).click();
  await page.locator("[data-issue-id]").filter({ hasText: "Minutes out of range" }).getByRole("button", { name: "Resolve…" }).click();
  const text = await page.getByRole("dialog").innerText();
  expect(text).not.toMatch(/replaces? (the )?(writers?|teachers?|editors?|humans?|experts?)|AI[- ]written|fully automated/i);
  await page.getByRole("button", { name: "Cancel" }).click();
  done("GR-16");
});

test("CON-G8: no route in the flow returns review minutes with a person's name", async () => {
  await noNamedMinutes(f!);
  done("CON-G8");
});

test("SCR-9: the rail shows issues and standards with a decision on the live workspace", async () => {
  const page = f!.reviewer.page;
  await openLesson(page, f!.lesson);
  await expect(page.getByRole("tab", { name: /Issues/ })).toBeVisible();
  await expect(page.getByRole("tab", { name: /Standards/ })).toBeVisible();
  await expect(page.locator("[data-issue-id]").first()).toBeVisible({ timeout: 20_000 });
  done("SCR-9");
});

test("OBS-11: WF-11 is registered and its capture test file exists", async () => {
  registered("WF-11", "test_resolution_capture", "con-14/resolve.spec.ts");
  done("OBS-11");
});

test("passed obligation ids", async () => {
  printPassed("wf-11", passed);
  expect([...passed].sort()).toEqual(["CON-G8", "GR-13", "GR-16", "GR-4", "GR-9", "OBS-11", "R-26", "R-28", "SCR-9"]);
});
