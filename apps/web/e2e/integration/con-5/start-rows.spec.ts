// NL-95 AC-1: starting rows 8, 9, 25 from the SCR-5 dialog writes one run + four jobs + one audit event, then lands on SCR-6.
import { createHash } from "node:crypto";
import { expect, test } from "@playwright/test";
import { SCHEMA_VERSION } from "@ls/editor-schema/schema";
import { db } from "../support/db";
import { authorWithConfirmedUpload, currentPrompt, openDialog } from "./helpers";

test("start-rows: rows 8, 9, 25 start one run with a plan job and three lesson jobs", async ({ page }) => {
  const { user, up } = await authorWithConfirmedUpload(page);
  const dialog = await openDialog(page, up);
  await expect(dialog.getByRole("radio", { name: "Chosen rows" })).toBeChecked();
  await expect(dialog.getByRole("textbox", { name: "Rows" })).toHaveValue("8, 9, 25");
  await expect(dialog.getByLabel(/Spend cap/)).toHaveValue("13.00");
  const prompt = await currentPrompt(page);
  const posted = page.waitForResponse((r) => r.url().endsWith("/api/runs") && r.request().method() === "POST");
  await dialog.getByRole("button", { name: "Start run" }).click();
  const res = await posted;
  expect(res.status()).toBe(201);
  await page.waitForURL(`**/units/${up.unit_key}/runs/*`);
  await expect(page.getByRole("dialog", { name: "Start a run" })).toHaveCount(0);

  const runs = await db().query<Record<string, unknown> & { id: string; run_id: string; kind: string; lesson_id: string | null; idempotency_key: string; queued_at: unknown; choices_hash: string; choices_json: unknown }>("select * from run where outline_version_id=$1", [up.outline_version_id]);
  expect(runs).toHaveLength(1);
  const run = runs[0]!;
  expect(run).toMatchObject({ state: "planning", kind: "run", started_by: user.user_id, prompt_version_id: prompt.current_prompt_version_id });
  expect(run.choices_hash).toMatch(/^[0-9a-f]{64}$/);
  expect(Array.isArray(run.choices_json) && run.choices_json.length).toBeGreaterThan(0);
  expect(((await res.json()) as { run_id: string }).run_id).toBe(run.id);

  const jobs = await db().query<Record<string, unknown> & { id: string; run_id: string; kind: string; lesson_id: string | null; idempotency_key: string; queued_at: unknown; choices_hash: string; choices_json: unknown }>("select * from lesson_job where run_id=$1 order by kind, lesson_id", [run.id]);
  expect(jobs).toHaveLength(4);
  expect(jobs.filter((j) => j.kind === "unit_plan")).toHaveLength(1);
  const lessons = jobs.filter((j) => j.kind === "lesson");
  expect(lessons).toHaveLength(3);
  const rowNumbers = await db().query<{ row_number: number }>(
    "select row_number from outline_row where outline_version_id=$1 and lesson_id = any($2) order by 1",
    [up.outline_version_id, lessons.map((j) => j.lesson_id)],
  );
  expect(rowNumbers.map((r) => r.row_number)).toEqual([8, 9, 25]);
  for (const j of jobs) {
    expect(j.run_id).toBe(run.id);
    expect(j.queued_at).not.toBeNull();
    // job key = sha256(run, lesson or "unit_plan", pinned prompt version, schema version): proves each job carries the pin
    const want = createHash("sha256").update([run.id, j.lesson_id ?? "unit_plan", prompt.current_prompt_version_id, String(SCHEMA_VERSION)].join("\n")).digest("hex");
    expect(j.idempotency_key).toBe(want);
  }
  const audit = await db().query("select * from audit_event where action='run.start' and target_id=$1", [run.id]);
  expect(audit).toHaveLength(1);
  expect(audit[0]).toMatchObject({ actor_id: user.user_id });
});
