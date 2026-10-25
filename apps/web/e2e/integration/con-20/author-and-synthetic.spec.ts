// NL-99 AC-3 (WF-16): authors send and store nothing; synthetic reviewers are stored flagged and counted nowhere.
import { expect, test } from "@playwright/test";
import { db } from "../support/db";
import { getStack } from "../support/real-stack";
import { createUser } from "../support/users";
import { ensureSeeded, freshUnit, seedLesson } from "./seed";
import { drive, lessonUrl, logBeats, userContext } from "./tabs";
import { DISCLOSURE_TEXT } from "./text";

test("author-and-synthetic: no author request, 403 on a direct call, synthetic stored flagged and excluded", async ({ browser }) => {
  test.setTimeout(150_000);
  await ensureSeeded();
  const unit = await freshUnit();
  const author = await createUser("author", { synthetic: false });
  const synth = await createUser("reviewer", { synthetic: true });
  const lesson = await seedLesson({ unit, number: 1, state: "in_review" });

  const a = await userContext(browser, author);
  const s = await userContext(browser, synth);
  const authorPage = await a.ctx.newPage();
  const synthPage = await s.ctx.newPage();
  const authorLog = logBeats(authorPage);
  const synthLog = logBeats(synthPage);
  await authorPage.goto(lessonUrl(lesson.unit_key, lesson.lesson_key));
  await synthPage.goto(lessonUrl(lesson.unit_key, lesson.lesson_key));
  await expect(synthPage.getByText(DISCLOSURE_TEXT)).toBeVisible({ timeout: 30_000 });
  const before = await (await s.ctx.request.get(`/api/units/${unit.unit_id}/metrics`)).json();
  await drive(
    [
      { page: authorPage, plan: { mode: "active" } },
      { page: synthPage, plan: { mode: "active" } },
    ],
    40,
  );
  await new Promise((r) => setTimeout(r, 1500));

  expect(authorLog.bodies, "author heartbeat requests from SCR-9").toHaveLength(0);
  expect(await db().count("heartbeat", "user_id = $1", [author.user_id])).toBe(0);

  const direct = await a.ctx.request.post(`/api/lessons/${lesson.lesson_id}/heartbeats`, {
    headers: { Origin: getStack().baseURL },
    data: { tab_id: "tab-author01", focused: true, visible: true, last_input_at: new Date().toISOString(), sent_at: new Date().toISOString(), version_id: "lv-1" },
  });
  expect(direct.status()).toBe(403);
  expect(JSON.stringify(await direct.json())).toContain("ROLE_FORBIDDEN");
  expect(await db().count("heartbeat", "user_id = $1", [author.user_id])).toBe(0);
  expect(await db().count("review_session", "user_id = $1", [author.user_id])).toBe(0);

  expect(synthLog.bodies.length).toBeGreaterThanOrEqual(2);
  const hb = await db().query<{ synthetic: boolean }>("select synthetic from heartbeat where user_id = $1", [synth.user_id]);
  expect(hb.length).toBe(synthLog.bodies.length);
  expect(hb.every((h) => h.synthetic)).toBe(true);
  const sess = await db().query<{ synthetic: boolean; active_seconds: number }>("select synthetic, active_seconds from review_session where user_id = $1", [synth.user_id]);
  expect(sess.length).toBe(1);
  expect(sess[0]!.synthetic).toBe(true);
  console.log(`synthetic stored: ${hb.length} flagged beats, ${sess[0]!.active_seconds}s flagged session; author rows 0`);

  const after = await (await s.ctx.request.get(`/api/units/${unit.unit_id}/metrics`)).json();
  expect(after).toEqual(before);
  expect(await db().count("lesson_metrics", "lesson_id = $1", [lesson.lesson_id])).toBe(0);
  await a.ctx.close();
  await s.ctx.close();
});
