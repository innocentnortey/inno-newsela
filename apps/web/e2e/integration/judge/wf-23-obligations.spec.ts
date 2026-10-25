// NL-110 AC-9: obligations that ride on WF-23 (R-54, GR-11, GR-13, OBS-11), against the real stack.
import { expect, test } from "@playwright/test";
import { db } from "../support/db";
import { getStack } from "../support/real-stack";
import { createUser, signInAs } from "../support/users";
import { checkRestrictedFolderRule, observabilityRow } from "../con-20/obligations";
import { submittedJudgeLesson } from "./seed";

test("R-54: anonymous callers get 401 on the issues route; an author is allowed to read it", async ({ playwright, page }) => {
  const s = await submittedJudgeLesson(false);
  const bare = await playwright.request.newContext({ baseURL: getStack().baseURL });
  expect((await bare.get(`/api/lessons/${s.lesson.lesson_id}/issues`)).status()).toBe(401);
  await bare.dispose();
  const author = await createUser("author", { synthetic: false });
  await signInAs(page, author);
  expect((await page.request.get(`/api/lessons/${s.lesson.lesson_id}/issues`)).status()).toBe(200);
});

test("GR-11: judge prompts hold only seeded-lesson text; no held-out published lesson is read", async () => {
  checkRestrictedFolderRule();
  const rows = await db().query<{ lesson_id: string }>("select distinct lesson_id from judge_verdict");
  for (const r of rows) expect(await db().count("lesson", "id = $1", [r.lesson_id])).toBe(1);
  const prompts = await db().query<{ rendered_prompt: string }>("select rendered_prompt from model_call where purpose = 'judge' limit 20");
  for (const p of prompts) expect(p.rendered_prompt).not.toMatch(/Grade 6 Unit 4 published/i);
});

test("GR-13: judge tables and issue columns carry no student or teacher field", async () => {
  const cols = await db().query<{ column_name: string }>("select column_name from information_schema.columns where table_name in ('judge_verdict','issue')");
  expect(cols.map((c) => c.column_name).filter((c) => /student|teacher_of|class|school/i.test(c))).toEqual([]);
});

test("OBS-11: WF-23 is registered in the observability design", async () => {
  expect(observabilityRow("WF-23")).toContain("test_judge_capture");
});
