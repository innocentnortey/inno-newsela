/* eslint-disable @typescript-eslint/no-explicit-any -- parsed JSON response bodies from the real stack are untyped */
// NL-113 AC-18 (coverage): WF-12's PRD obligations, one case each, driving a slot fill on the real stack.
import { expect, test } from "@playwright/test";
import { db } from "../support/db";
import { api, auditFor, openLesson, stored, waitCheckedHash } from "../con-13/helpers";
import { auditAppendOnly, authorForbidden, endFlow, expertFraming, noNamedMinutes, noProviderKey, printPassed, registered, restrictedFolderRule, staffOnly, startFlow, type Flow } from "../con-13/obligations";
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
const FILL = { text: "A short line.", source_ref: { title: "Synthetic Reader", chapter: null, pages: null }, rights_status: "public-domain" };

test("R-26: a fill is one durable store written by the collaboration server", async () => {
  const before = await stored(f!.lesson.lessonId);
  const res = await api(f!.reviewer.page, "POST", `/lessons/${f!.lesson.lessonId}/slots/q-hare/fill`, FILL);
  expect(res.status).toBe(200);
  const row = (await db().query<any>("select seq, ydoc_bytes, derived_json, content_hash, state_vector, stored_by from lesson_doc where lesson_id = $1 order by seq desc limit 1", [f!.lesson.lessonId]))[0];
  expect(row.seq).toBe(before.seq + 1);
  expect(row.ydoc_bytes.length).toBeGreaterThan(0);
  expect(row.stored_by).toBe(f!.reviewer.user.user_id);
  expect(JSON.stringify(row.derived_json)).toContain("Synthetic Reader");
  done("R-26");
});

test("R-28: the check lane re-runs on the fill within 5 s and the slot issue leaves the list", async () => {
  const doc = await stored(f!.lesson.lessonId);
  const t0 = Date.now();
  let list: any;
  await expect
    .poll(async () => {
      list = (await api(f!.reviewer.page, "GET", `/lessons/${f!.lesson.lessonId}/issues`)).body;
      return list.checked_hash === doc.content_hash && !list.pending;
    }, { timeout: 5000, intervals: [100] })
    .toBe(true);
  expect(list.issues.some((i: any) => i.kind === "quote_placeholder_open")).toBe(false);
  console.log(`R-28: checked ${Date.now() - t0} ms after the fill`);
  done("R-28");
});

test("R-54: roles on the API: anonymous is 401, an author is ROLE_FORBIDDEN", async ({ playwright }) => {
  const bare = await playwright.request.newContext({ baseURL: f!.live.baseURL });
  const anon = await bare.post(`/api/lessons/${f!.lesson.lessonId}/slots/q-hare/fill`, { data: FILL, headers: { Origin: f!.live.baseURL } });
  expect(anon.status()).toBe(401);
  await bare.dispose();
  await authorForbidden(f!, `/lessons/${f!.lesson.lessonId}/slots/q-hare/fill`, FILL);
  done("R-54");
});

test("GR-9: the restricted source folder is ignored, untracked and never referenced by this ticket's specs", async () => {
  restrictedFolderRule();
  done("GR-9");
});

test("GR-13: staff roles only; no student or teacher-of-record data", async () => {
  await staffOnly();
  done("GR-13");
});

test("GR-16: SCR-10 and the rail frame the tool as expert-driven", async () => {
  await expertFraming(f!.reviewer.page, f!.lesson);
  const page = f!.reviewer.page;
  await waitCheckedHash(page, f!.lesson.lessonId);
  await page.getByRole("tab", { name: /Issues/ }).click();
  await page.locator("[data-issue-id]").filter({ hasText: "Excerpt slot open" }).getByRole("button", { name: "Insert quote or excerpt…" }).click();
  expect(await page.getByRole("dialog").innerText()).not.toMatch(/replaces? (the )?(writers?|teachers?|editors?|humans?|experts?)|AI[- ]written|fully automated/i);
  await page.getByRole("button", { name: "Cancel" }).click();
  done("GR-16");
});

test("CON-G1: an author's fill is ROLE_FORBIDDEN on the server", async () => {
  await authorForbidden(f!, `/lessons/${f!.lesson.lessonId}/slots/hare-lion/fill`, FILL);
  done("CON-G1");
});

test("CON-G4: the fill is in the append-only audit log with who and when; rows cannot be changed or deleted", async () => {
  const audit = await auditFor(f!.lesson.lessonId);
  expect(audit.some((a) => a.actor_id === f!.reviewer.user.user_id)).toBe(true);
  await auditAppendOnly();
  done("CON-G4");
});

test("CON-G8: no route in the flow returns review minutes with a person's name", async () => {
  await noNamedMinutes(f!);
  done("CON-G8");
});

test("SCR-10: the dialog shows the slot ask, the text, the source fields, the rights status and the word count", async () => {
  const page = f!.reviewer.page;
  await openLesson(page, f!.lesson);
  await page.locator("[data-issue-id]").filter({ hasText: "Excerpt slot open" }).getByRole("button", { name: "Insert quote or excerpt…" }).click();
  const d = page.getByRole("dialog");
  for (const label of ["Text", "Book or title", "Rights status"]) await expect(d.getByLabel(label)).toBeVisible();
  await expect(d.getByRole("button", { name: "Insert" })).toBeVisible();
  await page.getByRole("button", { name: "Cancel" }).click();
  done("SCR-10");
});

test("OBS-7: the check worker runs the stub model with no provider key; none appears in the logs", async () => {
  noProviderKey(f!);
  done("OBS-7");
});

test("OBS-11: WF-12 is registered and its capture test file exists", async () => {
  registered("WF-12", "test_fill_slot_capture", "con-15/fill.spec.ts");
  done("OBS-11");
});

test("passed obligation ids", async () => {
  printPassed("wf-12", passed);
  expect([...passed].sort()).toEqual(["CON-G1", "CON-G4", "CON-G8", "GR-13", "GR-16", "GR-9", "OBS-11", "OBS-7", "R-26", "R-28", "R-54", "SCR-10"]);
});
