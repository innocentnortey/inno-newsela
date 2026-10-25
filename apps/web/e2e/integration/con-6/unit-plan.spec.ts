// NL-96 AC-3 (WF-21): SCR-7 shows the plan while it is written, then one entry per lesson; the unit_plan and model_call rows exist.
import { expect, test } from "@playwright/test";
import { db } from "../support/db";
import { COPY, FLEX, L4, L5, planUrl, startRun, waitRun, waitSql, type PlanResponse, settleAll } from "./helpers";
import { startWorker } from "./worker-harness";

test.afterEach(async ({ page }) => settleAll(page));

test("test_unit_plan_capture: Planning the unit, then one entry per lesson, WP-1's homework link, rows stored before the first claim", async ({ page }) => {
  test.setTimeout(180_000);
  const run = await startRun(page);
  const worker = await startWorker({ script: "script-a", holds: [["plan"]] });
  await page.goto(planUrl(run));
  await expect(page.getByText(COPY.PLANNING_TEXT)).toBeVisible();
  const planning = (await (await page.request.get(`/api/runs/${run.run_id}/plan`)).json()) as PlanResponse;
  expect(planning.state).toBe("planning");
  await waitSql(async () => worker.calls().length, (n) => n >= 1, 30_000);
  worker.release("plan");

  const list = page.getByRole("list", { name: "Teaching days" });
  await expect(list.getByRole("listitem")).toHaveCount(3, { timeout: 30_000 });
  const plan = (await (await page.request.get(`/api/runs/${run.run_id}/plan`)).json()) as PlanResponse;
  expect(plan.state).toBe("stored");
  expect(plan.entries.map((e) => e.lesson_id).sort()).toEqual([FLEX, L4, L5].sort());
  const items = await list.getByRole("listitem").allTextContents();
  for (const e of plan.entries) {
    expect(e.purpose.length).toBeGreaterThan(0);
    expect(e.routines.length, `routines for ${e.lesson_id} (returned by the API; SCR-7 does not render them)`).toBeGreaterThan(0);
    expect(items.some((t) => t.includes(e.purpose) && t.includes(`Hands forward: ${e.hands_forward}`))).toBe(true);
  }
  const homework = plan.lesson_links.find((l) => l.label.includes("Lesson 4 Homework"));
  console.log("AC-3 lesson links:", JSON.stringify(plan.lesson_links.map((l) => l.label)));
  expect(homework, "WP-1 link").toBeDefined();
  expect(homework!.label).toContain("Lesson 4 Homework → Lesson 5 excerpt slot"); // the real label continues with the excerpt title
  await expect(page.getByRole("listitem").filter({ hasText: "Lesson 4 Homework" }).filter({ hasText: "Lesson 5 excerpt slot" })).toBeVisible();

  await waitRun(run.run_id, ["partial", "complete"]);
  const [u] = await db().query<{ n: number; entries: number }>("select count(*)::int n, max(jsonb_array_length(entries_json->'entries'))::int entries from unit_plan where run_id=$1", [run.run_id]);
  expect(u).toEqual({ n: 1, entries: 3 });
  const calls = await db().query<{ rendered_prompt: string; raw_output: string }>("select rendered_prompt, raw_output from model_call where run_id=$1 and purpose='unit_plan'", [run.run_id]);
  expect(calls).toHaveLength(1);
  expect(calls[0]!.rendered_prompt.length).toBeGreaterThan(100);
  expect(calls[0]!.raw_output.length).toBeGreaterThan(10);
  const [o] = await db().query<{ before: boolean; stored: string; first: string }>(
    "select r.plan_stored_at < (select min(started_at) from lesson_job where run_id=r.id and kind='lesson') as before, r.plan_stored_at::text stored, (select min(started_at)::text from lesson_job where run_id=r.id and kind='lesson') first from run r where id=$1",
    [run.run_id],
  );
  console.log(`AC-3 stored_at=${o!.stored} min(started_at)=${o!.first}`);
  expect(o!.before).toBe(true);
  expect(plan.entries.length).toBe(u!.entries);
});
