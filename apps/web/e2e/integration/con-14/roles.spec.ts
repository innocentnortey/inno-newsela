// NL-113 AC-10 (con-14 half): an author cannot record a resolution or decide a standard; nothing changes.
import { expect, test } from "@playwright/test";
import { liveStack, stopLive } from "../con-13/stack";
import { enqueueCheck, seedWp1WithStandards } from "../con-13/seed";
import { api, auditFor, openAs, rows, waitCheckedHash } from "../con-13/helpers";

test.afterAll(stopLive);

test("roles: an author's recordResolution and decideStandard are ROLE_FORBIDDEN and change nothing", async ({ browser }) => {
  const live = await liveStack();
  const lesson = await seedWp1WithStandards();
  await enqueueCheck(lesson.lessonId);
  const a = await openAs(browser, live, "author", { bridge: false });
  try {
    const list = await waitCheckedHash(a.page, lesson.lessonId);
    const target = list.issues.find((i: { resolvable: boolean }) => i.resolvable);
    const snap = async () => ({ ...(await rows(lesson.lessonId)), audit: (await auditFor(lesson.lessonId)).length });
    const before = await snap();
    const resolve = await api(a.page, "POST", `/lessons/${lesson.lessonId}/issues/${target.issue_id}/resolution`, { reason: "I am an author" });
    expect(resolve.status).toBe(403);
    expect(resolve.body.error.code).toBe("ROLE_FORBIDDEN");
    const decide = await api(a.page, "POST", `/lessons/${lesson.lessonId}/standards/decision`, { code: "W.6.2", decision: "confirm" });
    expect(decide.status).toBe(403);
    expect(decide.body.error.code).toBe("ROLE_FORBIDDEN");
    expect(await snap()).toEqual(before);
    console.log(`roles: author recordResolution ${resolve.status} ${resolve.body.error.code}; decideStandard ${decide.status} ${decide.body.error.code}; rows unchanged`);
  } finally {
    await a.context.close();
  }
});
