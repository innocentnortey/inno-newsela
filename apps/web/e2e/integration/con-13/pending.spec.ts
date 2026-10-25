// NL-113 AC-2 (WF-10): while the check lane is held, the list is pending; when it runs, the rail re-reads.
import { expect, test } from "@playwright/test";
import { db } from "../support/db";
import { liveStack, stopLive, stopWorker } from "./stack";
import { enqueueCheck, seedWp1 } from "./seed";
import { issuesOf, openAs, openLesson, stored, waitCheckedHash } from "./helpers";

test.afterAll(stopLive);

test("pending: stored hash newer than checked hash shows Checking… and clears when the lane runs", async ({ browser }) => {
  const live = await liveStack();
  const lesson = await seedWp1();
  await enqueueCheck(lesson.lessonId);
  const r = await openAs(browser, live, "reviewer");
  try {
    await waitCheckedHash(r.page, lesson.lessonId);
    await openLesson(r.page, lesson);
    const submit = r.page.getByRole("button", { name: /Submit for approval/ });
    console.log(`pending: Submit disabled before = ${await submit.getAttribute("disabled")} / aria-disabled = ${await submit.getAttribute("aria-disabled")}`);
    await stopWorker();
    const before = await stored(lesson.lessonId);
    await r.page.locator('[data-testid^="section-"] [role="textbox"]').first().click();
    await r.page.keyboard.type(" HOLD");
    await expect.poll(async () => (await stored(lesson.lessonId)).seq, { timeout: 20_000 }).toBeGreaterThan(before.seq);
    const doc = await stored(lesson.lessonId);
    const list = (await issuesOf(r.page, lesson.lessonId)).body;
    expect(list.pending).toBe(true);
    expect(list.checked_hash).not.toBe(doc.content_hash);
    expect((await db().query("select 1 from check_job where lesson_id = $1 and status = 'queued'", [lesson.lessonId])).length).toBe(1);
    await expect(r.page.getByTestId("checking")).toBeVisible({ timeout: 30_000 });
    console.log(`pending: Submit disabled while pending = ${await submit.getAttribute("disabled")} / aria-disabled = ${await submit.getAttribute("aria-disabled")}`);
    await expect(submit).toBeDisabled();

    await liveStack({ fresh: true }); // restart the worker only
    await expect(r.page.getByTestId("checking")).toHaveCount(0, { timeout: 30_000 });
    const after = (await issuesOf(r.page, lesson.lessonId)).body;
    expect(after.pending).toBe(false);
    expect(after.checked_hash).toBe(doc.content_hash);
    console.log(`pending: cleared, checked_hash ${after.checked_hash.slice(0, 12)} = stored ${doc.content_hash.slice(0, 12)}; Submit disabled after = ${await submit.getAttribute("disabled")} (blocking ${after.counts.blocking})`);
  } finally {
    await r.context.close();
  }
});
