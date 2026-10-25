// NL-99 AC-2 (WF-16): close beats add no time; a failed request is dropped silently; the disclosure shows on both screens.
import { expect, test } from "@playwright/test";
import { db } from "../support/db";
import { createUser, signInAs } from "../support/users";
import { submittedLesson } from "./flow";
import { ensureSeeded, freshUnit, seedLesson } from "./seed";
import { lessonUrl } from "./tabs";
import { DISCLOSURE_TEXT } from "./text";

test("spacing-and-drop: beats under 10 s apart are stored but add no time", async ({ page }) => {
  await ensureSeeded();
  const unit = await freshUnit();
  const user = await createUser("reviewer", { synthetic: false });
  const lesson = await seedLesson({ unit, number: 1, state: "in_review", reviewer_id: user.user_id });
  await signInAs(page, user);
  await page.goto("/units");
  const now = () => new Date().toISOString();
  const statuses: number[] = [];
  for (let i = 0; i < 4; i++) {
    const status = await page.evaluate(
      async ({ id, at }) => {
        const r = await fetch(`/api/lessons/${id}/heartbeats`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ tab_id: "tab-spacing1", focused: true, visible: true, last_input_at: at, sent_at: at, version_id: "lv-1" }),
        });
        return r.status;
      },
      { id: lesson.lesson_id, at: now() },
    );
    statuses.push(status);
    await page.waitForTimeout(3000);
  }
  expect(statuses).toEqual([204, 204, 204, 204]);
  expect(await db().count("heartbeat", "lesson_id = $1", [lesson.lesson_id])).toBe(4);
  const sum = await db().query<{ s: number | null }>("select sum(active_seconds)::int as s from review_session where lesson_id = $1", [lesson.lesson_id]);
  expect(sum[0]?.s ?? 0, "stored-minute delta for the close beats").toBe(0);
});

test("spacing-and-drop: an aborted heartbeat is dropped silently, no error element", async ({ page }) => {
  test.setTimeout(90_000);
  await ensureSeeded();
  const unit = await freshUnit();
  const user = await createUser("reviewer", { synthetic: false });
  const lesson = await seedLesson({ unit, number: 1, state: "in_review", reviewer_id: user.user_id });
  await signInAs(page, user);
  let aborted = 0;
  await page.route("**/heartbeats", (route) => {
    aborted += 1;
    return route.abort();
  });
  await page.goto(lessonUrl(lesson.unit_key, lesson.lesson_key));
  await expect(page.getByText(DISCLOSURE_TEXT)).toBeVisible({ timeout: 30_000 });
  for (let i = 0; i < 4; i++) {
    await page.mouse.move(30 + i, 30);
    await page.waitForTimeout(4500);
  }
  expect(aborted, "the sender tried at least once").toBeGreaterThanOrEqual(1);
  // Next.js keeps an empty route announcer with role=alert; an error element would carry text.
  await expect(page.getByRole("alert").filter({ hasText: /\S/ })).toHaveCount(0);
  await expect(page.getByText(/heartbeat|couldn't record|failed to send/i)).toHaveCount(0);
  expect(await db().count("heartbeat", "lesson_id = $1", [lesson.lesson_id])).toBe(0);
});

test("spacing-and-drop: the disclosure sentence is on SCR-9 and SCR-14", async ({ page }) => {
  const s = await submittedLesson();
  await signInAs(page, s.reviewer);
  await page.goto(lessonUrl(s.lesson.unit_key, s.lesson.lesson_key));
  await expect(page.getByText(DISCLOSURE_TEXT)).toBeVisible({ timeout: 30_000 });
  await page.goto(lessonUrl(s.lesson.unit_key, s.lesson.lesson_key, true));
  await expect(page.getByText(DISCLOSURE_TEXT)).toBeVisible({ timeout: 30_000 });
});
