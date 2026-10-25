// NL-99 AC-6 (WF-16): the first frozen row is never edited. The reopen + second-row half is test.fixme with its reasons.
import { expect, test } from "@playwright/test";
import { db } from "../support/db";
import { getStack } from "../support/real-stack";
import { approveViaApi, metricsRows, reviewFor, submittedLesson } from "./flow";
import { userContext } from "./tabs";

test("reopen-new-row: the first row is byte-identical after an edit attempt and a reopen attempt; n is unchanged", async ({ browser }) => {
  test.setTimeout(150_000);
  const s = await submittedLesson();
  await reviewFor(browser, s, 20);
  const ap = await userContext(browser, s.approver);
  const page = await ap.ctx.newPage();
  const res = await approveViaApi(page, s);
  expect(res.status(), await res.text()).toBe(200);
  const first = await metricsRows(s.lesson.lesson_id);
  expect(first).toHaveLength(1);
  const metrics = async () => (await page.request.get(`/api/units/${s.unit.unit_id}/metrics`)).json();
  const before = await metrics();

  await expect(db().query("update lesson_metrics set active_minutes = 99 where lesson_id = $1", [s.lesson.lesson_id])).rejects.toThrow();
  await expect(db().query("delete from lesson_metrics where lesson_id = $1", [s.lesson.lesson_id])).rejects.toThrow();

  // Information only: the real reopen route today (see the fixme below for why this does not complete).
  const reopen = await page.request.post(`/api/lessons/${s.lesson.lesson_id}/transitions`, {
    data: { action: "reopen", reason: "e2e reopen", snapshot_hash: s.lesson.snapshot!.content_hash, snapshot_state_vector: s.lesson.snapshot!.state_vector },
    headers: { Origin: getStack().baseURL },
  });
  console.log(`reopen route answered ${reopen.status()}: ${(await reopen.text()).slice(0, 160)}`);

  const after = await metricsRows(s.lesson.lesson_id);
  expect(after).toEqual(first);
  expect(after[0]!.text).toBe(first[0]!.text);
  expect((await metrics()).north_star.n).toBe(before.north_star.n);
  expect(await db().count("lesson_metrics", "lesson_id = $1", [s.lesson.lesson_id])).toBe(1);
  await ap.ctx.close();
});

// The ticket says reopening and approving again writes a SECOND lesson_metrics row. Two things stop proving it here:
// 1. the shared stack (global-setup, NL-90, read-only) starts no collab server, and reopen sets the editor mode through
//    collab, so the real route answers COLLAB_UNAVAILABLE before any state changes;
// 2. migration 0009 makes lesson_id the PRIMARY KEY of lesson_metrics, PgMetricsRepo.write_lesson_metrics is
//    ON CONFLICT (lesson_id) DO NOTHING and MetricsWriter returns written = false once a row exists, so a second
//    approval cannot add a row at all. The ticket and the schema disagree: this needs a CHG (second row per approval,
//    e.g. an approval_seq column) before the assertion can be written honestly.
test.fixme("reopen-new-row: reopen then approve again writes a second row and leaves the first byte-identical", async () => {});
