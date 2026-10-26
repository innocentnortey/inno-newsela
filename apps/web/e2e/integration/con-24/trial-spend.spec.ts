// NL-103 AC-5 (WF-20): a trial settles its spend to its cost; a cap below one call refuses before any spend; the day cap refuses at start.
import { expect, test } from "@playwright/test";
import { db } from "../support/db";
import {
  authorSession, calls, driver, errorOf, insertSpend, LESSON, lessonRow, openGuidance, releaseSpend, startRun, startRunApi, trialBody,
} from "./helpers";
import { seedL4 } from "./seed";

test.describe.configure({ mode: "serial" });
test.setTimeout(240_000);
test.beforeAll(async ({ browser }) => {
  test.setTimeout(240_000);
  await seedL4(browser);
});
test.afterEach(releaseSpend);

const sum = (xs: (string | number)[]) => xs.reduce<number>((a, x) => a + Number(x), 0);

test("trial-spend: a good trial settles to its cost", async ({ page }) => {
  const { user, up } = await authorSession(page);
  const runId = await startRun(page, await trialBody(page, up, 1));
  await driver(["trial-pinned", runId]);
  const res = await db().query<{ status: string; settled_usd: string; reserved_usd: string; model_call_id: string | null; user_id: string }>(
    "select status, settled_usd, reserved_usd, model_call_id, user_id from spend_reservation where run_id=$1",
    [runId],
  );
  expect(res.length).toBeGreaterThanOrEqual(1);
  for (const r of res) {
    expect(r.status).toBe("settled");
    expect(Number(r.settled_usd)).toBeGreaterThan(0);
    expect(r.user_id).toBe(user.user_id);
  }
  const cs = await calls(runId);
  expect(cs.length).toBeGreaterThanOrEqual(1);
  for (const c of cs) {
    expect(c.rendered_prompt.length).toBeGreaterThan(0);
    expect((c.raw_output ?? "").length).toBeGreaterThan(0);
    expect(["completed", "ok", "success"]).toContain(c.status);
    expect(c.reservation_id).toBeTruthy();
  }
  expect(sum(res.map((r) => r.settled_usd))).toBeCloseTo(sum(cs.map((c) => c.cost_usd)), 6);
  const day = new Date().toISOString().slice(0, 10);
  const [tot] = await db().query<{ s: string }>("select coalesce(sum(settled_usd),0) s from spend_reservation where user_id=$1 and day=$2", [user.user_id, day]);
  expect(Number(tot!.s)).toBeCloseTo(sum(cs.map((c) => c.cost_usd)), 6);
});

test("trial-spend: a cap below one call is refused before any spend", async ({ page }) => {
  const { up } = await authorSession(page);
  const lesson0 = await lessonRow();
  const versions0 = await db().count("lesson_version", "lesson_id=$1", [LESSON]);
  const runId = await startRun(page, await trialBody(page, up, 0.0001));
  await driver(["trial-pinned", runId]);
  expect(await db().count("model_call", "run_id=$1", [runId])).toBe(0);
  expect(await db().count("spend_reservation", "run_id=$1", [runId])).toBe(0);
  expect(await db().count("lesson_version", "run_id=$1", [runId])).toBe(0);
  expect(await db().count("lesson_version", "lesson_id=$1", [LESSON])).toBe(versions0);
  expect(await lessonRow()).toEqual(lesson0);
  const [job] = await db().query<{ status: string; failure_reasons_json: unknown; brakes_fired: unknown }>(
    "select status, failure_reasons_json, brakes_fired from lesson_job where run_id=$1",
    [runId],
  );
  console.log(`trial-spend: refused job status=${job!.status} reasons=${JSON.stringify(job!.failure_reasons_json)} brakes=${JSON.stringify(job!.brakes_fired)}`);
  // observed on the first run, asserted exactly from now on
  expect(job!.status).toBe("generation_failed");
  expect(job!.brakes_fired).toEqual(["spend_run_cap"]);
});

test("trial-spend: the day cap refuses at start and writes nothing", async ({ page }) => {
  const { user, up } = await authorSession(page);
  await insertSpend(user.user_id, 25.5);
  const probe = await startRunApi(page, await trialBody(page, up, 13));
  expect(probe.status()).toBe(422);
  const err = await errorOf(probe);
  expect(err.code).toBe("DAY_CAP_REACHED");
  const remaining = err.details["remaining_usd"] as number;
  const runs0 = await db().count("run", "started_by=$1", [user.user_id]);
  const audit0 = await db().count("audit_event", "actor_id=$1 and action='run.start'", [user.user_id]);

  await openGuidance(page);
  const option = page.getByLabel("Lesson", { exact: true }).locator("option").filter({ hasText: /^Lesson 4:/ });
  await page.getByLabel("Lesson", { exact: true }).selectOption({ label: (await option.textContent())! });
  const cap = remaining;
  await page.getByRole("button", { name: "Try on one lesson" }).click();
  // the UI asks for a $1.00 cap; if that still fits the day, the refusal text below is not reached (the test then fails loudly)
  await expect(page.getByText(`The day's spend cap would be passed. Remaining: $${cap}.`)).toBeVisible();
  expect(await db().count("run", "started_by=$1", [user.user_id])).toBe(runs0);
  expect(await db().count("lesson_job", "run_id in (select id from run where started_by=$1)", [user.user_id])).toBe(0);
  expect(await db().count("audit_event", "actor_id=$1 and action='run.start'", [user.user_id])).toBe(audit0);
});
