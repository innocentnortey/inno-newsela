// GEN-5 (S-18, CHG-7): the workspace heartbeat names the lesson's real version, and the stored review session keeps it.
import { expect, test } from "@playwright/test";
import { db } from "../support/db";
import { createUser } from "../support/users";
import { ensureSeeded, freshUnit, seedLesson } from "./seed";
import { forceFocus, lessonUrl, logBeats, userContext } from "./tabs";
import { DISCLOSURE_TEXT } from "./text";

test("test_review_session_real_version: the stored review_session.version_id is the lesson's current version id", async ({ browser }) => {
  test.setTimeout(120_000);
  await ensureSeeded();
  const unit = await freshUnit();
  const user = await createUser("reviewer", { synthetic: false });
  const lesson = await seedLesson({ unit, number: 1, state: "in_review", reviewer_id: user.user_id });
  const [row] = await db().query<{ current_version_id: string }>("select current_version_id from lesson where id = $1", [lesson.lesson_id]);
  const realVersionId = row!.current_version_id;
  expect(realVersionId).toBeTruthy();

  const { ctx } = await userContext(browser, user);
  const page = await ctx.newPage();
  await forceFocus(page, { focused: true, visible: true });
  const log = logBeats(page);
  await page.goto(lessonUrl(lesson.unit_key, lesson.lesson_key));
  await expect(page.getByText(DISCLOSURE_TEXT)).toBeVisible({ timeout: 30_000 });

  // The first beat fires at 15 s; keep input fresh and allow up to 40 s.
  const deadline = Date.now() + 40_000;
  for (let i = 0; log.bodies.length === 0 && Date.now() < deadline; i++) {
    await page.mouse.move(20 + (i % 50), 20);
    await page.waitForTimeout(2000);
  }
  expect(log.bodies.length).toBeGreaterThan(0);
  expect(log.bodies[0]!.version_id).toBe(realVersionId);
  expect(log.bodies[0]!.version_id).not.toMatch(/^lv-\d+$/);

  const sessions = await db().query<{ version_id: string }>("select version_id from review_session where lesson_id = $1", [lesson.lesson_id]);
  expect(sessions).toHaveLength(1);
  expect(sessions[0]!.version_id).toBe(realVersionId);

  const res = await ctx.request.get(`/api/lessons/${encodeURIComponent(lesson.lesson_id)}`);
  expect(res.status()).toBe(200);
  expect(((await res.json()) as { version_id: string | null }).version_id).toBe(realVersionId);
  await ctx.close();
});
