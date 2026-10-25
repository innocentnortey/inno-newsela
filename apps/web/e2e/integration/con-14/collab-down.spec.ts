// NL-113 AC-10 (con-14 half): with the collab server down, decideStandard is COLLAB_UNAVAILABLE and the rows do not change.
import { expect, test } from "@playwright/test";
import { liveStack, stopCollab, stopLive } from "../con-13/stack";
import { enqueueCheck, seedWp1WithStandards } from "../con-13/seed";
import { api, auditFor, openAs, rows, waitCheckedHash } from "../con-13/helpers";

test.afterAll(stopLive);

test("collab_down: decideStandard answers COLLAB_UNAVAILABLE, rows unchanged, the reason only in the application log", async ({ browser }) => {
  const live = await liveStack();
  const lesson = await seedWp1WithStandards();
  await enqueueCheck(lesson.lessonId);
  const r = await openAs(browser, live, "reviewer", { bridge: false });
  try {
    await waitCheckedHash(r.page, lesson.lessonId);
    await stopCollab();
    const snap = async () => ({ ...(await rows(lesson.lessonId)), audit: (await auditFor(lesson.lessonId)).length });
    const before = await snap();
    const res = await api(r.page, "POST", `/lessons/${lesson.lessonId}/standards/decision`, { code: "W.6.2", decision: "confirm" });
    expect(res.status).toBe(503);
    expect(res.body.error.code).toBe("COLLAB_UNAVAILABLE");
    expect(JSON.stringify(res.body)).not.toMatch(/ECONNREFUSED|\n\s+at |stack/i);
    expect(await snap()).toEqual(before);
    expect(live.logs().some((l) => l.includes("collab.call_failed") && l.includes(lesson.lessonId))).toBe(true);
    console.log(`collab_down: decideStandard -> ${res.status} ${res.body.error.code}; application log has collab.call_failed`);
  } finally {
    await r.context.close();
  }
});
