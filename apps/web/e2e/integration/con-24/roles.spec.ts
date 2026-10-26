// NL-103 AC-6 (WF-20): a reviewer or approver sees SCR-21 read-only; direct saveGuidance and trial startRun are ROLE_FORBIDDEN and write nothing.
import { expect, test } from "@playwright/test";
import { ERROR_STATUS } from "../../../src/server/http/error-status.generated";
import { db } from "../support/db";
import { authorSession, errorOf, getPrompts, roleSession, saveApi, startRunApi, trialBody, PG_PATH } from "./helpers";
import { seedL4 } from "./seed";

test.describe.configure({ mode: "serial" });
test.beforeAll(async ({ browser }) => {
  test.setTimeout(240_000);
  await seedL4(browser);
});

const counts = async () => ({
  prompt_version: await db().count("prompt_version"),
  run: await db().count("run"),
  lesson_job: await db().count("lesson_job"),
  audit_event: await db().count("audit_event"),
});

for (const role of ["reviewer", "approver"] as const) {
  test(`roles: ${role} reads only`, async ({ page }) => {
    const { up } = await authorSession(page);
    const trial = await trialBody(page, up);
    const p = await getPrompts(page);
    await page.context().clearCookies();
    await roleSession(page, role);
    await page.goto(PG_PATH);
    await expect(page.getByRole("heading", { name: "Prompt guidance", level: 1 })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Locked rules (read-only)" })).toBeVisible();
    await expect(page.getByRole("list", { name: "Guidance versions" })).toBeVisible();
    await expect(page.getByText("Only authors edit guidance.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Save as new version" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Try on one lesson" })).toHaveCount(0);
    await expect(page.getByLabel("Guidance text")).toHaveCount(0);

    const before = await counts();
    const save = await saveApi(page, { base_version_id: p.current_prompt_version_id, guidance_text: "reviewer text", reason: "e2e forbidden" });
    expect(save.status()).toBe(ERROR_STATUS.ROLE_FORBIDDEN);
    expect((await errorOf(save)).code).toBe("ROLE_FORBIDDEN");
    const run = await startRunApi(page, trial);
    expect(run.status()).toBe(ERROR_STATUS.ROLE_FORBIDDEN);
    expect((await errorOf(run)).code).toBe("ROLE_FORBIDDEN");
    expect(await counts()).toEqual(before);
  });
}
