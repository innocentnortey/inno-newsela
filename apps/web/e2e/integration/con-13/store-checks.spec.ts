/* eslint-disable @typescript-eslint/no-explicit-any -- parsed JSON response bodies from the real stack are untyped */
// NL-113 AC-1 (WF-10): a store in the live editor produces a fresh issue list for the new hash within 5 s.
import { expect, test } from "@playwright/test";
import { db } from "../support/db";
import { liveStack, stopLive } from "./stack";
import { enqueueCheck, seedWp1 } from "./seed";
import { issuesOf, openAs, openLesson, stored, waitCheckedHash } from "./helpers";

test.afterAll(stopLive);

test("test_checks_after_store_capture [store_checks]: an edit stores a new hash and its issues arrive in 5 s", async ({ browser }) => {
  const live = await liveStack();
  const lesson = await seedWp1();
  await enqueueCheck(lesson.lessonId);
  const r = await openAs(browser, live, "reviewer");
  try {
    const first = await waitCheckedHash(r.page, lesson.lessonId);
    await openLesson(r.page, lesson);
    const before = await stored(lesson.lessonId);
    expect(first.checked_hash).toBe(before.content_hash);
    await r.page.locator('[data-testid^="section-"] [role="textbox"]').first().click();
    await r.page.keyboard.type(" NL113");
    // Wait for the collab store (a new lesson_doc row), then time the check lane from there.
    await expect.poll(async () => (await stored(lesson.lessonId)).seq, { timeout: 20_000 }).toBeGreaterThan(before.seq);
    const doc = await stored(lesson.lessonId);
    const t0 = Date.now();
    let list: any;
    await expect
      .poll(
        async () => {
          list = (await issuesOf(r.page, lesson.lessonId)).body;
          return list.checked_hash === doc.content_hash && list.pending === false;
        },
        { timeout: 5000, intervals: [100] },
      )
      .toBe(true);
    const elapsed = Date.now() - t0;
    console.log(`store_checks: new hash ${doc.content_hash.slice(0, 12)} checked ${elapsed} ms after the store; blocking ${list.counts.blocking}`);
    expect(elapsed).toBeLessThanOrEqual(5000);
    expect(list.issues.some((i: any) => i.kind === "standard_not_checked" && i.level === "blocking")).toBe(true);
    const job = await db().query<{ store_id: string; status: string }>("select store_id, status from check_job where lesson_id = $1 and content_hash = $2", [lesson.lessonId, doc.content_hash]);
    expect(job.length).toBeGreaterThanOrEqual(1);
    expect(job.every((j) => j.store_id === doc.store_id)).toBe(true);
  } finally {
    await r.context.close();
  }
});
