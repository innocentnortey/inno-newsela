// NL-125 AC-11: obligations that ride on WF-15 (lesson transitions), one case per id, driven through WF-15's real entry points
// (the SCR-9 Submit button, the SCR-14 Approve button, the transitions route) on the real stack with three live contexts.
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { expect, test } from "@playwright/test";
import { startCon18Stack, type Con18Stack } from "../../integration/con-18/stack";
import { apiAs, storedVector, transition } from "../../integration/con-18/flow";
import { submittedLesson } from "../../integration/con-20/flow";
import { lessonUrl } from "../../integration/con-20/tabs";
import { DISCLOSURE_TEXT } from "../../integration/con-20/text";
import { bannedIn } from "../../integration/support/copy-rules";
import { signInAs } from "../../integration/support/users";
import { openApproval, openEditor, stale_approve, zero_edits_after_lock } from "../scenarios";
import { buildWorld, closeWorld, type Rec, type World } from "../trial";
import { BANNED, ROOT, registered, restrictedFolderRule, staffOnly } from "./support";

test.describe.configure({ mode: "serial" });
let stack: Con18Stack;
const rec = (): Rec => ({ detail: {}, request_ids: [], store_ms: null, store_id: null });

test.beforeAll(async () => {
  test.setTimeout(240_000);
  stack = await startCon18Stack();
});
test.afterAll(async () => {
  await stack?.stop();
});

test("GR-9: the restricted source folder is ignored, untracked and never referenced by this ticket's files", async () => {
  restrictedFolderRule();
});

test("GR-13: staff roles only; the transition responses and rows carry ids, no student or teacher-of-record field", async ({ browser }) => {
  await staffOnly();
  const w = await buildWorld(browser, stack, 0);
  try {
    expect(w.A.user.email.endsWith("@example.test")).toBe(true);
    const apiA = await apiAs(stack, w.A.user);
    const r = await transition(apiA, w.lesson.lesson_id, { action: "submit", client_state_vector: await storedVector(w.lesson.lesson_id) });
    expect(r.status, r.text).toBe(200);
    expect(r.text).not.toMatch(/student|teacher_of_record|school_id|class_id/i);
  } finally {
    await closeWorld(w);
  }
});

test("GR-16: SCR-9 and SCR-14 frame the tool as expert-driven, never as replacing writers", async ({ page }) => {
  const s = await submittedLesson();
  await signInAs(page, s.reviewer);
  for (const approve of [false, true]) {
    await page.goto(lessonUrl(s.lesson.unit_key, s.lesson.lesson_key, approve));
    await expect(page.getByText(DISCLOSURE_TEXT)).toBeVisible({ timeout: 30_000 });
    const text = await page.locator("body").innerText();
    expect(text).not.toMatch(BANNED);
    expect(bannedIn(text)).toEqual([]);
  }
});

test("SCR-9: the refused notice and the read-only state are reachable in the live workspace", async ({ browser }) => {
  test.setTimeout(120_000);
  const w = await buildWorld(browser, stack, 0, { heldA: true });
  try {
    await zero_edits_after_lock(w, rec()); // asserts the notice, `Removed text`, aria-readonly=true and the read_only client state
  } finally {
    await closeWorld(w);
  }
});

test("SCR-14: the stale banner is reachable on the approval review", async ({ browser }) => {
  test.setTimeout(120_000);
  const w = await buildWorld(browser, stack, 0);
  try {
    await stale_approve(w, rec()); // asserts COPY.stale on C's page and the reload to the new snapshot
  } finally {
    await closeWorld(w);
  }
});

test("SCR-15: the send-back dialog opens from the SCR-14 decision card", async ({ browser }) => {
  test.setTimeout(120_000);
  const w: World = await buildWorld(browser, stack, 0);
  try {
    await openEditor(w, w.A);
    const apiA = await apiAs(stack, w.A.user);
    const sub = await transition(apiA, w.lesson.lesson_id, { action: "submit", client_state_vector: await storedVector(w.lesson.lesson_id) });
    expect(sub.status, sub.text).toBe(200);
    await openApproval(w, w.C);
    await w.C.page.getByRole("button", { name: "Request changes" }).click();
    await expect(w.C.page.getByRole("dialog", { name: /Request changes to Lesson/ })).toBeVisible();
  } finally {
    await closeWorld(w);
  }
});

test("EV-S7: the S7 suite (WP-4 safety notes, 4 of 4) is green; the WP-4 approve refusal is that suite's case, cited here", async () => {
  const r = spawnSync("npx", ["vitest", "run", "evals/src/suites/s7.test.ts"], { cwd: ROOT, encoding: "utf8", timeout: 120_000 });
  expect(r.status, (r.stdout + r.stderr).slice(-800)).toBe(0);
});

test("OBS-11: WF-15, WF-9 and WF-43 are registered with their capture tests", async () => {
  registered("WF-15", "test_transition_capture", join(ROOT, "apps/web/e2e/integration/con-18/transitions.spec.ts"));
  registered("WF-9", "test_store_capture", join(ROOT, "apps/web/e2e/integration/con-12/store-capture.spec.ts"));
  registered("WF-43", "test_integrity_suite_records", join(ROOT, "evals/src/suites/s5.test.ts"));
});
