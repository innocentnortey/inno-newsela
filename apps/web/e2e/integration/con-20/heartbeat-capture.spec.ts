// NL-99 AC-1 (WF-16): the compressed S8 script through the real sender, route and store.
import { expect, test } from "@playwright/test";
import { db } from "../support/db";
import { createUser } from "../support/users";
import { runS8, table } from "./runner";
import { ensureSeeded, freshUnit, seedLesson } from "./seed";
import { forceFocus, lessonUrl, logBeats, userContext } from "./tabs";
import { DISCLOSURE_TEXT } from "./text";

test("test_heartbeat_capture: scripted 3-lesson review in two tabs matches the oracle within 1 minute", async ({ browser }) => {
  test.setTimeout(480_000);
  const r = await runS8(browser);
  console.log(`S8 script vs stored (compressed real time)\n${table(r)}`);
  for (const l of r.lessons) {
    expect(Math.abs(l.stored_seconds - l.script_seconds), `lesson ${l.lesson}: stored ${l.stored_seconds}s vs script ${l.script_seconds}s`).toBeLessThanOrEqual(60);
    const rows = await db().count("heartbeat", "lesson_id = $1", [l.lesson_id]);
    expect(rows, `lesson ${l.lesson} beats stored`).toBe(l.beats_sent);
  }
  const l3 = r.lessons[2]!;
  // One user in two tabs for 120 s counts about 105 s (first beat opens the session), never about 210 s.
  expect(l3.a_seconds).toBeLessThanOrEqual(120);
  expect(l3.a_seconds).toBeGreaterThanOrEqual(l3.a_script_seconds - 60);
  // The idle tab adds at most one minute.
  expect(l3.b_seconds).toBeLessThanOrEqual(60);
});

test("test_heartbeat_capture: a tab that is not focused or not visible sends nothing", async ({ browser }) => {
  test.setTimeout(120_000);
  await ensureSeeded();
  const unit = await freshUnit();
  const user = await createUser("reviewer", { synthetic: false });
  const lesson = await seedLesson({ unit, number: 1, state: "in_review", reviewer_id: user.user_id });
  const { ctx } = await userContext(browser, user);
  const page = await ctx.newPage();
  await forceFocus(page, { focused: false, visible: true });
  const log = logBeats(page);
  await page.goto(lessonUrl(lesson.unit_key, lesson.lesson_key));
  await expect(page.getByText(DISCLOSURE_TEXT)).toBeVisible({ timeout: 30_000 });
  for (let i = 0; i < 4; i++) {
    await page.mouse.move(20 + i, 20);
    await page.waitForTimeout(4500);
  }
  expect(log.bodies).toHaveLength(0);
  expect(await db().count("heartbeat", "lesson_id = $1", [lesson.lesson_id])).toBe(0);
  await ctx.close();
});
