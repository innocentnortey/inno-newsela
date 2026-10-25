// NL-113 AC-10 (con-15 half): with the collab server down, fillSlot is COLLAB_UNAVAILABLE and the rows do not change.
import { expect, test } from "@playwright/test";
import { liveStack, stopCollab, stopLive } from "../con-13/stack";
import { enqueueCheck, seedWp1 } from "../con-13/seed";
import { api, auditFor, openAs, rows, waitCheckedHash } from "../con-13/helpers";

test.afterAll(stopLive);

test("collab_down: fillSlot answers COLLAB_UNAVAILABLE, rows unchanged, the reason only in the application log", async ({ browser }) => {
  const live = await liveStack();
  const lesson = await seedWp1();
  await enqueueCheck(lesson.lessonId);
  const r = await openAs(browser, live, "reviewer", { bridge: false });
  try {
    await waitCheckedHash(r.page, lesson.lessonId);
    await stopCollab();
    const before = { ...(await rows(lesson.lessonId)), audit: (await auditFor(lesson.lessonId)).length };
    const res = await api(r.page, "POST", `/lessons/${lesson.lessonId}/slots/q-hare/fill`, {
      text: "A short line.", source_ref: { title: "Synthetic Reader", chapter: null, pages: null }, rights_status: "public-domain",
    });
    expect(res.status).toBe(503);
    expect(res.body.error.code).toBe("COLLAB_UNAVAILABLE");
    expect(JSON.stringify(res.body)).not.toMatch(/ECONNREFUSED|\n\s+at |stack/i);
    expect({ ...(await rows(lesson.lessonId)), audit: (await auditFor(lesson.lessonId)).length }).toEqual(before);
    expect(live.logs().some((l) => l.includes("collab.call_failed") && l.includes(lesson.lessonId))).toBe(true);
    console.log(`collab_down: fillSlot -> ${res.status} ${res.body.error.code}; application log has collab.call_failed`);
  } finally {
    await r.context.close();
  }
});
