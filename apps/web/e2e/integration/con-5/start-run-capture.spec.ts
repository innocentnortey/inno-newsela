// NL-95 AC-2: WF-4 capture. Full unit starts 47 lesson jobs + 1 plan job (stub provider, no worker); a refusal writes nothing.
import { expect, test } from "@playwright/test";
import { db } from "../support/db";
import { authorWithConfirmedUpload, currentPrompt, rowCounts, runBody, startRunApi, uniqueKey } from "./helpers";

test("test_start_run_capture: 47 lesson jobs plus the plan job, and a refusal that writes nothing", async ({ page }) => {
  test.setTimeout(180_000);
  await test.step("WF-4: start a run on the full issued unit", async () => {
    const { user, up } = await authorWithConfirmedUpload(page);
    const prompt = await currentPrompt(page);
    const res = await startRunApi(page, await runBody(page, up.outline_version_id, { kind: "all" }), uniqueKey());
    expect(res.status(), await res.text()).toBe(201);
    const { run_id } = (await res.json()) as { run_id: string };
    const jobs = await db().query<{ kind: string; run_id: string }>("select kind, run_id from lesson_job where run_id=$1", [run_id]);
    expect(jobs.filter((j) => j.kind === "lesson")).toHaveLength(47);
    expect(jobs.filter((j) => j.kind === "unit_plan")).toHaveLength(1);
    expect(jobs).toHaveLength(48);
    expect(jobs.every((j) => j.run_id === run_id)).toBe(true);
    const [row] = await db().query<{ prompt_version_id: string }>("select prompt_version_id from run where id=$1", [run_id]);
    expect(row!.prompt_version_id).toBe(prompt.current_prompt_version_id);
    expect(await db().count("model_call", "run_id=$1", [run_id]), "stub provider, no worker: no model call").toBe(0);
    expect((await rowCounts(user.user_id)).run).toBe(1);
  });
  await test.step("WF-4: one error unconfirmed is refused with VALIDATION_INCOMPLETE and writes nothing", async () => {
    await page.context().clearCookies();
    const { user, up } = await authorWithConfirmedUpload(page, 1);
    const before = await rowCounts(user.user_id);
    const res = await startRunApi(page, await runBody(page, up.outline_version_id, { kind: "all" }), uniqueKey());
    expect(res.status()).toBe(422);
    expect(((await res.json()) as { error: { code: string } }).error.code).toBe("VALIDATION_INCOMPLETE");
    expect(await rowCounts(user.user_id)).toEqual(before);
  });
});
