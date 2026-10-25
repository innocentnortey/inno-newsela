// NL-113 AC-8: fill refusals change nothing; a to-clear fill stores and leaves a blocking rights_to_clear issue.
import { expect, test } from "@playwright/test";
import { db } from "../support/db";
import { liveStack, stopLive } from "../con-13/stack";
import { enqueueCheck, seedWp1 } from "../con-13/seed";
import { api, issuesOf, openAs, rows, waitCheckedHash } from "../con-13/helpers";

test.afterAll(stopLive);

const fill = (text: string, title: string, rights: string) => ({ text, source_ref: { title, chapter: null, pages: null }, rights_status: rights });
const THIRTEEN = "The cat sat quietly on the warm window sill and then it left";

test("slot_refusals: source, length and lock refusals leave the document alone; to-clear stores and still blocks", async ({ browser }) => {
  const live = await liveStack();
  const lesson = await seedWp1();
  const locked = await seedWp1("submitted");
  await enqueueCheck(lesson.lessonId);
  const r = await openAs(browser, live, "reviewer");
  try {
    await waitCheckedHash(r.page, lesson.lessonId);
    const docs = async (id: string) => (await rows(id)).doc;
    const slot = (id: string, s: string) => `/lessons/${id}/slots/${s}/fill`;

    let n = await docs(lesson.lessonId);
    const noSource = await api(r.page, "POST", slot(lesson.lessonId, "q-hare"), fill("A short line.", " ", "public-domain"));
    expect(noSource.status).toBe(422);
    expect(noSource.body.error.code).toBe("SOURCE_REQUIRED");
    expect(await docs(lesson.lessonId)).toBe(n);

    const tooLong = await api(r.page, "POST", slot(lesson.lessonId, "q-hare"), fill(THIRTEEN, "Synthetic Reader", "short-quote-commentary"));
    expect(tooLong.status).toBe(422);
    expect(tooLong.body.error.code).toBe("QUOTE_TOO_LONG");
    expect(await docs(lesson.lessonId)).toBe(n);

    n = await docs(locked.lessonId);
    const lockedRes = await api(r.page, "POST", slot(locked.lessonId, "q-hare"), fill("A short line.", "Synthetic Reader", "public-domain"));
    console.log(`slot_refusals: ${noSource.status} ${noSource.body.error.code}; ${tooLong.status} ${tooLong.body.error.code}; locked ${lockedRes.status} ${lockedRes.body.error?.code}`);
    expect(lockedRes.status).toBe(409);
    expect(lockedRes.body.error.code).toBe("LESSON_LOCKED");
    expect(await docs(locked.lessonId)).toBe(n);

    n = await docs(lesson.lessonId);
    const toClear = await api(r.page, "POST", slot(lesson.lessonId, "q-hare"), fill("A short line.", "Synthetic Reader", "to-clear"));
    expect(toClear.status).toBe(200);
    expect(toClear.body.still_blocking).toBe(true);
    expect(await docs(lesson.lessonId)).toBe(n + 1);
    const list = await waitCheckedHash(r.page, lesson.lessonId);
    const rights = list.issues.filter((i: { kind: string; level: string }) => i.kind === "rights_to_clear" && i.level === "blocking");
    expect(rights.length).toBeGreaterThanOrEqual(1);
    void issuesOf; void db;
  } finally {
    await r.context.close();
  }
});
