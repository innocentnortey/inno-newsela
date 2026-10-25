// NL-99 AC-5 (WF-16): the approver approves through SCR-14; one frozen row, equal to the oracle; the north-star median uses it.
import { expect, test } from "@playwright/test";
import { db } from "../support/db";
import { metricsRows, oracleMinutes, reviewFor, submittedLesson } from "./flow";
import { lessonUrl, userContext } from "./tabs";

const REVIEW_S = 50;

test("first-approval-row: SCR-14 approval writes exactly one frozen row equal to the oracle", async ({ browser }) => {
  test.setTimeout(180_000);
  const s = await submittedLesson();
  await reviewFor(browser, s, REVIEW_S);

  const ap = await userContext(browser, s.approver);
  const page = await ap.ctx.newPage();
  await page.goto(lessonUrl(s.lesson.unit_key, s.lesson.lesson_key, true));
  await page.getByText("Usable with edits").click();
  await page.getByRole("button", { name: "Approve this version" }).click();
  await expect(page.getByText(/Approved by .* · pinned .* · Usable with edits/)).toBeVisible({ timeout: 20_000 });

  const rows = await metricsRows(s.lesson.lesson_id);
  expect(rows, "exactly one lesson_metrics row").toHaveLength(1);
  const row = rows[0]!;
  const expectedMinutes = oracleMinutes(REVIEW_S);
  console.log(`oracle ${expectedMinutes} min, stored ${row.active_minutes} min, words ${row.teacher_word_count}, g2 ${row.g2_threshold_minutes}, rating ${row.draft_rating}, sessions ${row.human_sessions}`);
  expect(Math.abs(Number(row.active_minutes) - expectedMinutes)).toBeLessThanOrEqual(1);
  expect(row.teacher_word_count).toBe(s.lesson.words);
  expect(Number(row.g2_threshold_minutes)).toBeCloseTo(Math.round((s.lesson.words / 250) * 0.5 * 100) / 100, 2);
  expect(row.draft_rating).toBe(2);
  expect(row.version_id).toBe((await db().query<{ id: string }>("select id from lesson_version where lesson_id = $1 and kind = 'approve'", [s.lesson.lesson_id]))[0]!.id);
  const sum = await db().query<{ s: number }>("select sum(active_seconds)::int as s from review_session where lesson_id = $1 and not synthetic", [s.lesson.lesson_id]);
  expect(Number(row.active_minutes)).toBeCloseTo(Math.round((sum[0]!.s / 60) * 100) / 100, 2);

  const m = await (await page.request.get(`/api/units/${s.unit.unit_id}/metrics`)).json();
  expect(m.north_star.n).toBe(1);
  expect(m.north_star.median_minutes).toBeCloseTo(Number(row.active_minutes), 2);
  await ap.ctx.close();
});
