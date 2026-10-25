// NL-113 AC-10 (con-15 half): an author cannot fill a slot; nothing changes.
import { expect, test } from "@playwright/test";
import { liveStack, stopLive } from "../con-13/stack";
import { seedWp1 } from "../con-13/seed";
import { api, auditFor, openAs, rows } from "../con-13/helpers";

test.afterAll(stopLive);

test("roles: an author's fillSlot is ROLE_FORBIDDEN and changes nothing", async ({ browser }) => {
  const live = await liveStack();
  const lesson = await seedWp1();
  const a = await openAs(browser, live, "author", { bridge: false });
  try {
    const before = { ...(await rows(lesson.lessonId)), audit: (await auditFor(lesson.lessonId)).length };
    const res = await api(a.page, "POST", `/lessons/${lesson.lessonId}/slots/q-hare/fill`, {
      text: "A short line.", source_ref: { title: "Synthetic Reader", chapter: null, pages: null }, rights_status: "public-domain",
    });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("ROLE_FORBIDDEN");
    expect({ ...(await rows(lesson.lessonId)), audit: (await auditFor(lesson.lessonId)).length }).toEqual(before);
    console.log(`roles: author fillSlot -> ${res.status} ${res.body.error.code}; rows unchanged`);
  } finally {
    await a.context.close();
  }
});
