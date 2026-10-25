// NL-99 flow helpers: a reviewer sits on SCR-9 of a submitted lesson, then an approver approves it.
import { expect, type Browser, type Page } from "@playwright/test";
import { db } from "../support/db";
import { getStack } from "../support/real-stack";
import { createUser, type TestUser } from "../support/users";
import { expectedUserSeconds } from "./oracle";
import type { Segment } from "./script";
import { ensureSeeded, freshUnit, seedLesson, type SeededLesson } from "./seed";
import { drive, lessonUrl, userContext } from "./tabs";
import { DISCLOSURE_TEXT } from "./text";

export interface Submitted {
  reviewer: TestUser;
  approver: TestUser;
  lesson: SeededLesson;
  unit: { unit_id: string; unit_key: string };
}

export async function submittedLesson(): Promise<Submitted> {
  await ensureSeeded();
  const unit = await freshUnit();
  const reviewer = await createUser("reviewer", { synthetic: false });
  const approver = await createUser("approver", { synthetic: false });
  const lesson = await seedLesson({ unit, number: 1, content: "wp3", state: "submitted", reviewer_id: reviewer.user_id, last_editor_id: reviewer.user_id });
  return { reviewer, approver, lesson, unit };
}

export const reviewSegment = (seconds: number): Segment => ({ lesson: 1, seconds, tabs: [{ tab: "T1", who: "A", mode: "active" }] });

// The reviewer reads the lesson on SCR-9 for `seconds` of real time with input every few seconds.
export async function reviewFor(browser: Browser, s: Submitted, seconds: number): Promise<void> {
  const { ctx } = await userContext(browser, s.reviewer);
  try {
    const page = await ctx.newPage();
    await page.goto(lessonUrl(s.lesson.unit_key, s.lesson.lesson_key));
    await expect(page.getByText(DISCLOSURE_TEXT)).toBeVisible({ timeout: 30_000 });
    await drive([{ page, plan: { mode: "active" } }], seconds);
    await new Promise((r) => setTimeout(r, 1500));
  } finally {
    await ctx.close();
  }
}

export function approveBody(s: Submitted, rating = "usable_with_edits") {
  const snap = s.lesson.snapshot!;
  return { action: "approve", snapshot_hash: snap.content_hash, snapshot_state_vector: snap.state_vector, rating };
}

export async function approveViaApi(page: Page, s: Submitted, rating = "usable_with_edits") {
  return page.request.post(`/api/lessons/${s.lesson.lesson_id}/transitions`, {
    data: approveBody(s, rating),
    headers: { Origin: getStack().baseURL },
  });
}

export async function metricsRows(lesson_id: string) {
  return db().query<{ active_minutes: string; teacher_word_count: number; g2_threshold_minutes: string; draft_rating: number; human_sessions: number; version_id: string; text: string }>(
    "select active_minutes::text, teacher_word_count, g2_threshold_minutes::text, draft_rating, human_sessions, version_id, m::text as text from lesson_metrics m where lesson_id = $1",
    [lesson_id],
  );
}

export const oracleMinutes = (seconds: number): number => expectedUserSeconds(reviewSegment(seconds), "A") / 60;
