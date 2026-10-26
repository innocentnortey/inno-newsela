// NL-125 AC-13: obligations that ride on WF-9 (socket edit and durable store), one case per id, on the real stack.
import { join } from "node:path";
import { expect, test } from "@playwright/test";
import { apiAs, approveBody, flowRowsText, latestSubmit, storedVector, transition } from "../../integration/con-18/flow";
import { DISTINCT_MINUTES, DISTINCT_SECONDS, seedReviewTime } from "../../integration/con-18/seed";
import { startCon18Stack, type Con18Stack } from "../../integration/con-18/stack";
import { db } from "../../integration/support/db";
import { submittedLesson } from "../../integration/con-20/flow";
import { lessonUrl } from "../../integration/con-20/tabs";
import { DISCLOSURE_TEXT } from "../../integration/con-20/text";
import { signInAs } from "../../integration/support/users";
import { openEditor } from "../scenarios";
import { buildWorld, closeWorld } from "../trial";
import { BANNED, ROOT, registered, staffOnly } from "./support";

test.describe.configure({ mode: "serial" });
let stack: Con18Stack;
test.beforeAll(async () => {
  test.setTimeout(240_000);
  stack = await startCon18Stack();
});
test.afterAll(async () => {
  await stack?.stop();
});

test("GR-13: staff roles only; no student or teacher-of-record column in any table the store writes", async () => {
  await staffOnly();
  const cols = await db().query<{ column_name: string }>("select column_name from information_schema.columns where table_name in ('lesson_doc','audit_event','check_job')");
  expect(cols.map((c) => c.column_name).filter((c) => /student|teacher|class|school/i.test(c))).toEqual([]);
});

test("GR-16: the editor page frames the tool as expert-driven, never as replacing writers", async ({ page }) => {
  const s = await submittedLesson();
  await signInAs(page, s.reviewer);
  await page.goto(lessonUrl(s.lesson.unit_key, s.lesson.lesson_key, false));
  await expect(page.getByText(DISCLOSURE_TEXT)).toBeVisible({ timeout: 30_000 });
  expect(await page.locator("body").innerText()).not.toMatch(BANNED);
});

test("CON-G4: every action leaves an append-only row with who, when, from, to and version; update and delete are rejected", async ({ browser }) => {
  test.setTimeout(120_000);
  const w = await buildWorld(browser, stack, 0);
  try {
    await openEditor(w, w.A);
    const id = w.lesson.lesson_id;
    const apiA = await apiAs(stack, w.A.user);
    const apiC = await apiAs(stack, w.C.user);
    expect((await transition(apiA, id, { action: "submit", client_state_vector: await storedVector(id) })).status).toBe(200);
    const snap = await latestSubmit(id);
    expect((await transition(apiC, id, approveBody({ snapshot_hash: snap.content_hash, snapshot_state_vector: snap.state_vector }))).status).toBe(200);
    const events = await db().query<{ actor_id: string; at: Date; from_state: string; to_state: string; version_id: string | null; id: string }>(
      "select id, actor_id, at, from_state, to_state, version_id from review_event where lesson_id = $1 order by at", [id]);
    expect(events.map((e) => [e.from_state, e.to_state])).toEqual([["in_review", "submitted"], ["submitted", "approved"]]);
    for (const e of events) {
      expect(e.actor_id).toBeTruthy();
      expect(e.at).toBeInstanceOf(Date);
      expect(e.version_id).toBeTruthy();
    }
    const [audit] = await db().query<{ id: string }>("select id from audit_event limit 1");
    await expect(db().query("update review_event set note = 'x' where id = $1", [events[0]!.id])).rejects.toThrow(/append-only/);
    await expect(db().query("delete from review_event where id = $1", [events[0]!.id])).rejects.toThrow(/append-only/);
    if (audit) {
      await expect(db().query("update audit_event set reason = 'x' where id = $1", [audit.id])).rejects.toThrow(/append-only/);
      await expect(db().query("delete from audit_event where id = $1", [audit.id])).rejects.toThrow(/append-only/);
    }
    expect(await db().count("review_event", "lesson_id = $1", [id])).toBe(2);
  } finally {
    await closeWorld(w);
  }
});

test("CON-G8: a distinctive review time (7.77 min) never comes back with a name in the responses, the audit rows or the logs", async ({ browser }) => {
  test.setTimeout(120_000);
  const w = await buildWorld(browser, stack, 0);
  try {
    const id = w.lesson.lesson_id;
    const apiA = await apiAs(stack, w.A.user);
    const apiC = await apiAs(stack, w.C.user);
    const sub = await transition(apiA, id, { action: "submit", client_state_vector: await storedVector(id) });
    expect(sub.status, sub.text).toBe(200);
    const snap = await latestSubmit(id);
    await seedReviewTime(w.A.user, { ...w.lesson, snapshot: { version_id: snap.version_id, content_hash: snap.content_hash, state_vector: snap.state_vector } });
    const logsBefore = stack.logs().length;
    const ok = await transition(apiC, id, approveBody({ snapshot_hash: snap.content_hash, snapshot_state_vector: snap.state_vector }));
    expect(ok.status, ok.text).toBe(200);
    const seen = [sub.text, ok.text, await (await apiC.get(`/api/lessons/${id}/history`)).text(), await (await apiC.get(`/api/lessons/${id}`)).text()];
    const rows = await flowRowsText([id]);
    const logs = stack.logs().slice(logsBefore).join("\n");
    const [m] = await db().query<{ active_minutes: string }>("select active_minutes::text from lesson_metrics where lesson_id = $1", [id]);
    expect(m!.active_minutes, "the value really flowed into the frozen row").toBe(DISTINCT_MINUTES);
    for (const [what, hay] of [["responses", seen.join("\n")], ["audit rows", rows], ["log lines", logs]] as const) {
      expect(hay.split(DISTINCT_MINUTES).length - 1, `${what} contains ${DISTINCT_MINUTES}`).toBe(0);
      expect(hay.split(String(DISTINCT_SECONDS)).length - 1, `${what} contains ${DISTINCT_SECONDS}`).toBe(0);
      expect(hay, `${what} names a reviewer with minutes`).not.toMatch(/active_(minutes|seconds)/);
    }
  } finally {
    await closeWorld(w);
  }
});

test("OBS-11: WF-9 is registered with test_store_capture and the store-capture spec exists", async () => {
  registered("WF-9", "test_store_capture", join(ROOT, "apps/web/e2e/integration/con-12/store-capture.spec.ts"));
});
