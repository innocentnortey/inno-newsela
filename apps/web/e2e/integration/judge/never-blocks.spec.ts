// NL-110 AC-2 (API half) and AC-3 never_blocks: a judge "no" is an advisory issue; Submit and Approve are unaffected.
import { expect, test } from "@playwright/test";
import { db } from "../support/db";
import { getStack } from "../support/real-stack";
import { signInAs } from "../support/users";
import { approveViaApi } from "../con-20/flow";
import { submittedJudgeLesson } from "./seed";
import { startJudgeWorker } from "./worker";

let stop_worker: (() => Promise<void>) | undefined;
test.beforeAll(async () => {
  stop_worker = await startJudgeWorker();
});
test.afterAll(async () => {
  await stop_worker?.();
});

interface IssueList {
  counts: { blocking: number; confirmation: number; advisory: number };
  issues: { kind?: string; level: string; blocks: string[]; message: string }[];
}

async function poll_verdicts(lesson_id: string, want: number): Promise<number> {
  let n = 0;
  for (let i = 0; i < 80; i++) {
    n = Number((await db().query<{ c: string }>("select count(*) c from judge_verdict where lesson_id = $1", [lesson_id]))[0]!.c);
    if (n >= want) return n;
    await new Promise((r) => setTimeout(r, 500));
  }
  return n;
}

test("never_blocks: a judge no is advisory and Approve still succeeds", async ({ page, browser }) => {
  test.setTimeout(150_000);
  const control = await submittedJudgeLesson(false);
  const marked = await submittedJudgeLesson(true);
  expect(marked.pairs).toBeGreaterThan(0);
  await poll_verdicts(control.lesson.lesson_id, control.pairs);
  await poll_verdicts(marked.lesson.lesson_id, marked.pairs);

  await signInAs(page, marked.reviewer);
  const get = async (id: string): Promise<IssueList> => {
    const r = await page.request.get(`/api/lessons/${id}/issues`);
    expect(r.status()).toBe(200);
    return (await r.json()) as IssueList;
  };
  const m = await get(marked.lesson.lesson_id);
  const c = await get(control.lesson.lesson_id);
  const rows = await db().query<{ level: string; message: string }>("select level, message from issue where lesson_id = $1 and kind = 'judge_no'", [marked.lesson.lesson_id]);
  expect(rows.length).toBeGreaterThan(0);
  expect(rows.every((r) => r.level === "advisory" && r.message.includes("Provisional"))).toBe(true);
  expect(await db().count("issue", "lesson_id = $1 and kind = 'judge_no'", [control.lesson.lesson_id])).toBe(0);
  const adv = m.issues.filter((i) => i.level === "advisory" && i.message.includes("Provisional"));
  expect(adv.length).toBe(rows.length);
  for (const i of adv) expect(i.blocks).toEqual([]);
  expect(m.counts.blocking).toBe(c.counts.blocking);
  expect(m.counts.confirmation).toBe(c.counts.confirmation);

  // Reachable from the live entry point: SCR-9 shows the provisional label.
  await page.goto(`/units/${marked.unit.unit_key}/lessons/${marked.lesson.lesson_key}`);
  await expect(page.getByText(/Provisional/).first()).toBeVisible({ timeout: 30_000 });

  const approver_ctx = await browser.newContext();
  const approver_page = await approver_ctx.newPage();
  await approver_page.goto(getStack().baseURL);
  await signInAs(approver_page, marked.approver);
  const res = await approveViaApi(approver_page, marked);
  const body = await res.text();
  await approver_ctx.close();
  expect(res.status(), body).toBe(200);
  expect(await db().count("audit_event", "target_id = $1 and action ilike '%refus%'", [marked.lesson.lesson_id])).toBe(0);
});
