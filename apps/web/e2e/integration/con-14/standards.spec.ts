// NL-113 AC-6: confirm, remove and undo a standard from the rail on the real stack (collab applies the doc edit).
import { expect, test } from "@playwright/test";
import { db } from "../support/db";
import { liveStack, stopLive } from "../con-13/stack";
import { enqueueCheck, seedWp1WithStandards } from "../con-13/seed";
import { api, auditFor, lastEditor, openAs, openLesson, stored, waitCheckedHash } from "../con-13/helpers";

test.afterAll(stopLive);

const links = (lessonId: string, code: string) =>
  db().query<{ asserted_by: string; confirmed_by: string | null; content_hash: string }>(
    "select asserted_by, confirmed_by, content_hash from alignment_link where lesson_id = $1 and code = $2 and content_hash = (select content_hash from lesson_doc where lesson_id = $1 order by seq desc limit 1) order by address",
    [lessonId, code],
  );

test("standards: confirm from the rail, remove, undo restores code, links and hash; a later decision expires the earlier undo", async ({ browser }) => {
  const live = await liveStack();
  const lesson = await seedWp1WithStandards();
  await enqueueCheck(lesson.lessonId);
  const r = await openAs(browser, live, "reviewer");
  try {
    const list = await waitCheckedHash(r.page, lesson.lessonId);
    await openLesson(r.page, lesson);
    await r.page.getByRole("tab", { name: /Standards/ }).click();
    const before = await stored(lesson.lessonId);
    await r.page.getByRole("button", { name: "Confirm SL.6.1" }).click();
    await expect(r.page.getByText("Confirmed SL.6.1.").first()).toBeVisible();
    await waitCheckedHash(r.page, lesson.lessonId);
    const confirmed = await links(lesson.lessonId, "SL.6.1");
    console.log(`standards: confirm -> links ${JSON.stringify(confirmed.map((l) => [l.asserted_by, l.confirmed_by]))}; last_editor ${await lastEditor(lesson.lessonId)}; hash ${before.content_hash.slice(0, 12)} -> ${(await stored(lesson.lessonId)).content_hash.slice(0, 12)}`);
    expect(confirmed.some((l) => l.asserted_by === r.user.user_id || l.confirmed_by === r.user.user_id)).toBe(true);
    expect(await lastEditor(lesson.lessonId)).toBe(r.user.user_id);

    await waitCheckedHash(r.page, lesson.lessonId);
    // remove, then undo through the API with the audit id of the decision
    const preRemove = await stored(lesson.lessonId);
    const linksBefore = await links(lesson.lessonId, "W.6.2");
    const removed = await api(r.page, "POST", `/lessons/${lesson.lessonId}/standards/decision`, { code: "W.6.2", decision: "remove" });
    expect(removed.status).toBe(200);
    await waitCheckedHash(r.page, lesson.lessonId);
    expect(await links(lesson.lessonId, "W.6.2")).toHaveLength(0);
    const undone = await api(r.page, "POST", `/lessons/${lesson.lessonId}/standards/decision`, { code: "W.6.2", decision: "undo", undo_of: removed.body.audit_id });
    expect(undone.status).toBe(200);
    await waitCheckedHash(r.page, lesson.lessonId);
    const postUndo = await stored(lesson.lessonId);
    console.log(`standards: undo -> hash before remove ${preRemove.content_hash.slice(0, 12)} after undo ${postUndo.content_hash.slice(0, 12)}; links ${linksBefore.length} -> ${(await links(lesson.lessonId, "W.6.2")).length}`);
    expect(postUndo.content_hash).toBe(preRemove.content_hash);
    expect((await links(lesson.lessonId, "W.6.2")).length).toBe(linksBefore.length);

    // a later decision on the same code makes the earlier undo expire
    await waitCheckedHash(r.page, lesson.lessonId);
    const first = await api(r.page, "POST", `/lessons/${lesson.lessonId}/standards/decision`, { code: "W.6.2", decision: "confirm" });
    expect(first.status).toBe(200);
    await waitCheckedHash(r.page, lesson.lessonId);
    const second = await api(r.page, "POST", `/lessons/${lesson.lessonId}/standards/decision`, { code: "W.6.2", decision: "remove" });
    expect(second.status).toBe(200);
    await waitCheckedHash(r.page, lesson.lessonId);
    const stale = await api(r.page, "POST", `/lessons/${lesson.lessonId}/standards/decision`, { code: "W.6.2", decision: "undo", undo_of: first.body.audit_id });
    expect(stale.status).toBeGreaterThanOrEqual(400);
    expect(stale.body.error.code).toBe("UNDO_EXPIRED");
    expect((await auditFor(lesson.lessonId)).length).toBeGreaterThan(0);
  } finally {
    await r.context.close();
  }
});
