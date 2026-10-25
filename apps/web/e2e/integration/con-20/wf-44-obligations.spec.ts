// NL-99 AC-13: obligations that ride on WF-44, the S8 suite (R-49, GR-9, GR-13, GR-15, EV-S8, EV-R1, OBS-1, OBS-6, OBS-7, OBS-11, M-1, M-43).
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "@playwright/test";
import { db } from "../support/db";
import { getStack } from "../support/real-stack";
import { createUser, signInAs } from "../support/users";
import { approveViaApi, metricsRows, reviewFor, submittedLesson, type Submitted } from "./flow";
import { checkRegistered, checkRestrictedFolderRule, WEB } from "./obligations";
import { cachedResult, recordS8Row, runS8, type S8Result } from "./runner";
import { logBeats, userContext, lessonUrl } from "./tabs";
import { DISCLOSURE_TEXT } from "./text";

test.describe.configure({ mode: "serial" });

let approved: Submitted;
let s8: S8Result;
test.beforeAll(async ({ browser }) => {
  test.setTimeout(500_000);
  approved = await submittedLesson();
  await reviewFor(browser, approved, 20);
  const ap = await userContext(browser, approved.approver);
  const page = await ap.ctx.newPage();
  const r = await approveViaApi(page, approved);
  if (r.status() !== 200) throw new Error(`approve failed: ${r.status()} ${await r.text()}`);
  const m = await (await page.request.get(`/api/units/${approved.unit.unit_id}/metrics`)).json();
  (globalThis as { __m?: unknown }).__m = m;
  await ap.ctx.close();
  s8 = cachedResult() ?? (await runS8(browser));
  if (!(await s8Row())) await recordS8Row(s8);
});

async function s8Row() {
  const rows = await db().query<{ id: string; git_sha: string; provider_mode: string; models_json: unknown; case_set: string; expected_json: unknown; actual_json: unknown; case_id: string }>(
    "select r.id, r.git_sha, r.provider_mode, r.models_json, r.case_set, c.expected_json, c.actual_json, c.case_id from eval_run r join eval_case_result c on c.eval_run_id = r.id where r.suite = 'S8' order by r.started_at desc limit 1",
  );
  return rows[0];
}

test("R-49: a lone tab beats about every 15 s; two tabs of one user count once; humans only", async ({ browser }) => {
  test.setTimeout(120_000);
  const s = await submittedLesson();
  const { ctx } = await userContext(browser, s.reviewer);
  const page = await ctx.newPage();
  const stamps: number[] = [];
  page.on("request", (r) => { if (r.url().includes("/heartbeats")) stamps.push(Date.now()); });
  logBeats(page);
  await page.goto(lessonUrl(s.lesson.unit_key, s.lesson.lesson_key));
  await expect(page.getByText(DISCLOSURE_TEXT)).toBeVisible({ timeout: 30_000 });
  for (let i = 0; i < 9; i++) {
    await page.mouse.move(20 + i, 20);
    await page.waitForTimeout(4200);
  }
  expect(stamps.length).toBeGreaterThanOrEqual(2);
  const gap = (stamps[1]! - stamps[0]!) / 1000;
  expect(gap).toBeGreaterThan(13);
  expect(gap).toBeLessThan(17);
  await ctx.close();
  const l3 = s8.lessons[2]!;
  expect(l3.a_seconds, "S8 lesson 3: user A in two tabs counts once").toBeLessThanOrEqual(120);
  expect(await db().count("review_session", "synthetic and lesson_id = $1", [l3.lesson_id])).toBe(0);
});

test("GR-9: restricted folder stays out of git and out of this folder's specs", async () => {
  checkRestrictedFolderRule();
});

test("GR-13: no student or teacher-of-record data in anything the review stored", async () => {
  const roles = await db().query<{ role: string }>("select distinct role from app_user");
  for (const r of roles) expect(["author", "reviewer", "approver"]).toContain(r.role);
  const dump = await db().query<{ t: string }>("select h::text as t from heartbeat h limit 50");
  expect(dump.map((d) => d.t).join("\n")).not.toMatch(/student|teacher/i);
});

test("GR-15: unit totals only: the metrics body has no per-person fields and labels a small segment", async () => {
  const m = (globalThis as { __m?: { north_star: Record<string, unknown> } }).__m!;
  expect(Object.keys(m.north_star).sort()).toEqual(["approved", "caption", "fast_approvals", "median_minutes", "n", "segment_label"]);
  expect(m.north_star["segment_label"]).toMatch(/one reviewer, n = 1/);
  expect(JSON.stringify(m)).not.toContain(approved.reviewer.name);
});

test("EV-S8: scripted +-1 min per lesson, idle tab <= 1 min, two tabs counted once", async () => {
  for (const l of s8.lessons) expect(Math.abs(l.stored_seconds - l.script_seconds), `lesson ${l.lesson}`).toBeLessThanOrEqual(60);
  expect(s8.lessons[2]!.b_seconds).toBeLessThanOrEqual(60);
  expect(s8.lessons[2]!.a_seconds).toBeLessThanOrEqual(120);
});

test("EV-R1: the S8 eval run names the git SHA, provider mode and model list", async () => {
  const row = await s8Row();
  expect(row, "S8 eval_run row").toBeDefined();
  expect(row!.git_sha).toMatch(/^[0-9a-f]{40}$/);
  expect(row!.provider_mode).toBe("stub");
  expect(row!.models_json).toEqual({});
});

test("OBS-1: the capture test drives the real page and asserts stored heartbeat rows", async () => {
  const src = readFileSync(join(WEB, "e2e/integration/con-20/heartbeat-capture.spec.ts"), "utf8");
  expect(src).toContain('db().count("heartbeat"');
  expect(src).toContain("runS8");
  for (const l of s8.lessons) expect(await db().count("heartbeat", "lesson_id = $1", [l.lesson_id])).toBe(l.beats_sent);
});

test("OBS-6: an eval run mints its own id and stores its configuration", async () => {
  const row = await s8Row();
  expect(row, "S8 eval_run row").toBeDefined();
  expect(row!.id).toMatch(/^ev/);
  expect(row!.case_set).toBe("s8-scripted-3-lesson-review");
});

test("OBS-7: no password, provider key or lesson text in the logs or the heartbeat rows", async ({ page }) => {
  const u = await createUser("reviewer", { synthetic: false });
  await signInAs(page, u);
  const logs = getStack().logs().join("\n");
  expect(logs).not.toContain(u.password);
  expect(logs).not.toMatch(/sk-ant-|sk-or-|ANTHROPIC_API_KEY=|OPENROUTER_API_KEY=/);
  const dump = await db().dumpAll();
  expect(dump).not.toContain(u.password);
  const hbs = (await db().query<{ t: string }>("select h::text as t from heartbeat h")).map((x) => x.t).join("\n");
  expect(hbs).not.toContain("hare and a lion");
});

test("OBS-11: WF-44 is registered", async () => {
  checkRegistered("WF-44", "test_heartbeat_suite_records", "s8-result-row.spec.ts");
});

test("M-1: reviewer minutes per approved lesson are computable from lesson_metrics", async () => {
  const rows = await metricsRows(approved.lesson.lesson_id);
  expect(rows).toHaveLength(1);
  expect(Number(rows[0]!.active_minutes)).toBeGreaterThanOrEqual(0);
  const m = (globalThis as { __m?: { north_star: { median_minutes: number | null } } }).__m!;
  expect(m.north_star.median_minutes).toBeCloseTo(Number(rows[0]!.active_minutes), 2);
});

test("M-43: heartbeat accuracy is computable from the S8 case results", async () => {
  const row = await s8Row();
  expect(row, "S8 case result").toBeDefined();
  const e = row!.expected_json as Record<string, number>;
  const a = row!.actual_json as Record<string, number | boolean>;
  expect(Object.keys(e).length).toBeGreaterThan(0);
  for (const k of Object.keys(e)) expect(typeof a[k]).toBe("number");
});
